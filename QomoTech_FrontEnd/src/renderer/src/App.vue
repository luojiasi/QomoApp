<template>

  
  <div class="fixed right-6 top-4 z-50 flex space-x-4">
  <CameraPic :hidden-keep-alive="true" :show-hint="false" alt="global-camera-stream-keeper" />
    <button
      class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-green-500 shadow"
      type="button"
      @click="handleMaximize"
    ></button>
    <button
      class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-yellow-500 shadow"
      type="button"
      @click="handleMinimize"
    ></button>
    <button
      class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-red-500 shadow"
      type="button"
      @click="handleClose"
    ></button>


  </div>

  <NotificationToast ref="toastRef" />
  <RouterView />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CameraPic from './components/cameraPic.vue'
import NotificationToast from './components/NotificationToast.vue'
import {
  registerNotificationToast,
  type NotificationToastExpose
} from './composables/useNotification'
import { useAuthStore } from './stores/auth'
import { useLicenseStore } from './stores/license'
import { dispatchGlobalKeyboard } from './utils/globalKeyboard'
import { RS232_WORKBENCH_STORAGE_KEY } from './stores/rs232WorkbenchStore'
import type { Rs232SerialSessionRequest } from './types/settings'
import { syncRs232Workbench } from './utils/rs232Api'

const toastRef = ref<InstanceType<typeof NotificationToast> | null>(null)
const router = useRouter()
const authStore = useAuthStore()
const licenseStore = useLicenseStore()
let licenseTimer: number | null = null

function isTypingFocusTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}


// 浏览器在 window 上捕获到每一次 keydown 时调用
const onWindowKeydown = (event: KeyboardEvent): void => {
  if (isTypingFocusTarget(event.target)) return
  dispatchGlobalKeyboard(event)
}

let globalKeydownAttached = false


// 用 globalKeydownAttached 防止重复 addEventListener / 重复 remove
const attachGlobalKeydown = (): void => {
  if (globalKeydownAttached) return
  window.addEventListener('keydown', onWindowKeydown)
  globalKeydownAttached = true
}

const detachGlobalKeydown = (): void => {
  if (!globalKeydownAttached) return
  window.removeEventListener('keydown', onWindowKeydown)
  globalKeydownAttached = false
}

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      attachGlobalKeydown()
      void syncRs232WorkbenchAfterLogin()
    } else {
      detachGlobalKeydown()
    }
  },
  { immediate: true }
)

const handleClose = (): void => {window.electron?.ipcRenderer?.send('window-control', 'close')}

const handleMinimize = (): void => {window.electron?.ipcRenderer?.send('window-control', 'minimize')}

const handleMaximize = (): void => {window.electron?.ipcRenderer?.send('window-control', 'maximize')}

const syncLicenseStatus = async (): Promise<void> => {
  const status = await licenseStore.refreshStatus()

  if (!status.valid && router.currentRoute.value.name !== 'license') {
    authStore.logout()
    await router.push('/license')
  }
}

function parseRs232SessionFromLocalStorage(): Rs232SerialSessionRequest | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RS232_WORKBENCH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const port = parsed.port as Record<string, unknown> | undefined
    const send = parsed.send as Record<string, unknown> | undefined
    const receive = parsed.receive as Record<string, unknown> | undefined
    if (!port || !send || !receive) return null
    if (typeof port.portName !== 'string' || !port.portName.trim()) return null
    return {
      port: port as unknown as Rs232SerialSessionRequest['port'],
      send: send as unknown as Rs232SerialSessionRequest['send'],
      receive: receive as unknown as Rs232SerialSessionRequest['receive']
    }
  } catch {
    return null
  }
}

async function syncRs232WorkbenchAfterLogin(): Promise<void> {
  const workbenchPayload = parseRs232SessionFromLocalStorage()
  if (!workbenchPayload) return
  await syncRs232Workbench(workbenchPayload)
}

onMounted(async () => {
  await nextTick()
  const inst = toastRef.value as unknown as NotificationToastExpose | null
  registerNotificationToast(inst)
  await syncLicenseStatus()
  licenseTimer = window.setInterval(() => {
    void syncLicenseStatus()
  }, 30_000)
})

onUnmounted(() => {
  detachGlobalKeydown()
  if (licenseTimer) {
    window.clearInterval(licenseTimer)
  }

  registerNotificationToast(null)
})
</script>
