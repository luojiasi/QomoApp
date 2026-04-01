<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useLicenseStore } from '../stores/license'
// import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import { getDesktopBackendRuntimeStatus, type BackendRuntimeStatus } from '../utils/desktopBridge'
// import { bootstrapControllerOnce } from '../utils/backendBootstrap'
const { success, error } = useNotification()


const router = useRouter()
const authStore = useAuthStore()
const licenseStore = useLicenseStore()
// const controllerSettingsStore = useControllerSettingsStore()

const username = ref('')
const password = ref('')








// 获取控制器状态

const backendStatus = ref<BackendRuntimeStatus>({
  state: 'starting',
  isReachable: false,
  message: '正在检测后台服务...'
})

const BACKEND_POLL_MS = 2000
let backendPollTimer: ReturnType<typeof setInterval> | undefined

const refreshBackendStatus = async () => backendStatus.value = await getDesktopBackendRuntimeStatus()

const backendDotClass = computed(() => {
  switch (backendStatus.value.state) {
    case 'running':
      return 'bg-green-500'
    default:
      return 'bg-red-500'
  }
})




const canLogin = computed(() => backendStatus.value.state === 'running')

const handleLogin = async () => {
  const licenseStatus = await licenseStore.refreshStatus()

  if (!licenseStatus.valid) {
    error(licenseStatus.message)
    await router.push('/license')
    return
  }

  if (!canLogin.value) {
    error(backendStatus.value.message || '后台未就绪，请稍后重试')
    return
  }

  if (!username.value.trim() || !password.value.trim()) {
    error('请输入用户名和密码')
    return
  }

  const result = authStore.login(username.value, password.value)

  if (!result.success) {
    error(result.message)
    return
  }

  success(result.message)

  // try {
  //   await controllerSettingsStore.loadControllerSettings()
  //   const controllerRes = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
  //   if (!controllerRes.success) {
  //     error(controllerRes.message)
  //   }
  // } catch {
  //   error('控制器初始化失败：无法连接后端或硬件未就绪。')
  // }

  await router.push('/home')
}

onMounted(async () => {
  const licenseStatus = await licenseStore.refreshStatus()
  await refreshBackendStatus()
  backendPollTimer = setInterval(() => {
    void refreshBackendStatus()
  }, BACKEND_POLL_MS)

  if (!licenseStatus.valid) {
    await router.push('/license')
  }
})

onUnmounted(() => {
  if (backendPollTimer) {
    clearInterval(backendPollTimer)
    backendPollTimer = undefined
  }
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
      <div class="app-card w-full rounded-2xl p-8 shadow-lg">
        <div class="mb-8 text-center">
          <h1 class="app-text-primary text-3xl font-bold">QomoTech</h1>
          <div class="app-text-secondary mt-2 flex items-center justify-center gap-2 text-sm">
            <span class="h-2 w-2 rounded-full" :class="backendDotClass" />
            <span>{{ backendStatus.message }}</span>
          </div>
          <p class="app-text-muted mt-2 text-xs">
            剩余使用时间：{{ licenseStore.status.remainingDays }}天
          </p>
        </div>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <div>
            <label class="app-text-secondary mb-2 block text-sm font-medium">用户名</label>
            <input
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              class="app-input w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label class="app-text-secondary mb-2 block text-sm font-medium">密码</label>
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              class="app-input w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            :disabled="!canLogin"
            class="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
