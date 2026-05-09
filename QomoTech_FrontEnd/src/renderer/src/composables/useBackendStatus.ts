import { computed, ref, onUnmounted } from 'vue'
import { getDesktopBackendRuntimeStatus, type BackendRuntimeStatus } from '../api/desktopBridge'

const BACKEND_POLL_MS = 2000

export function useBackendStatus() {
  const backendStatus = ref<BackendRuntimeStatus>({
    state: 'starting',
    isReachable: false,
    message: '正在检测后台服务...'
  })

  let timer: ReturnType<typeof setInterval> | undefined

  const refresh = async () => {
    backendStatus.value = await getDesktopBackendRuntimeStatus()
  }

  const startPolling = async (ms = BACKEND_POLL_MS) => {
    stopPolling()
    await refresh()
    timer = setInterval(refresh, ms)
  }

  const stopPolling = () => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  onUnmounted(stopPolling)

  const backendDotClass = computed(() =>
    backendStatus.value.state === 'running' ? 'bg-green-500' : 'bg-red-500'
  )

  return { backendStatus, backendDotClass, refresh, startPolling, stopPolling }
}
