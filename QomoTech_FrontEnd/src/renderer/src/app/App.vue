<template>
  <div class="fixed right-6 top-4 z-50 flex space-x-4">
    <CameraPic :hidden-keep-alive="true" :show-hint="false" alt="global-camera-stream-keeper" />
    <WindowControlButtons />
  </div>

  <NotificationToast ref="toastRef" />
  <RouterView />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CameraPic from '@/modules/camera/CameraPic.vue'
import NotificationToast from '@/shared/components/NotificationToast.vue'
import WindowControlButtons from '@/shared/components/WindowControlButtons.vue'
import {
  registerNotificationToast,
  type NotificationToastExpose
} from '@/shared/composables/useNotification'


import { useAuthStore} from '@/modules/auth/stores/useAuthStore'
import { useLicenseStore } from '@/modules/auth/stores/licenseStore'
import { useControllerSettingsStore } from '@/modules/motion/stores/useControllerSettingsStore'
import { dispatchGlobalKeyboard } from '@/shared/composables/useGlobalKeyboard'
import { parseRs232SessionFromLocalStorage } from '@/modules/laser/utils/rs232'
import { syncRs232Workbench } from '@/modules/laser/api/rs232'
import type { HomeState } from '@/modules/motion/types'
const toastRef = ref<InstanceType<typeof NotificationToast> | null>(null)
const router = useRouter()
const authStore = useAuthStore()
const licenseStore = useLicenseStore()
const controllerSettingsStore = useControllerSettingsStore()
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

const syncLicenseStatus = async (): Promise<void> => {
  const status = await licenseStore.refreshStatus()

  if (!status.valid && router.currentRoute.value.name !== 'license') {
    authStore.logout()
    await router.push('/license')
  }
}

async function syncRs232WorkbenchAfterLogin(): Promise<void> {
  const workbenchPayload = parseRs232SessionFromLocalStorage()
  if (!workbenchPayload) return
  await syncRs232Workbench(workbenchPayload)
}

onMounted(async () => {
  const nextHomeState: HomeState = {
    ...controllerSettingsStore.loadHomeState(),
    ISARRIVEDHOME: false
  }
  controllerSettingsStore.saveHomeState(nextHomeState)
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
