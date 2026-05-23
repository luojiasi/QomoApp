import './main.css'
import '@resources/iconfont/iconfont.js'

import { applySavedTheme } from '@/shared/composables/useAppColorScheme'
import { notify } from '@/shared/composables/useNotification'
import pinia from '@/shared/stores/pinia'
import App from './App.vue'
import router from './router'
import { startGlobalCameraReceiver } from '@/modules/camera/composables/useCameraReceiver'
import { startHardwareMonitor } from '@/shared/api/hardware'
import { createApp } from 'vue'

applySavedTheme()
// 相机首次与后端进行连接
startGlobalCameraReceiver()
// 硬件状态监控（WS 驱动）
startHardwareMonitor()

// 全局错误捕获，防止渲染进程静默崩溃
window.addEventListener('error', (event) => {
  const detail = event.error
    ? `\n  message: ${(event.error as Error).message}\n  stack: ${(event.error as Error).stack?.split('\n').slice(0, 6).join('\n')}`
    : `\n  source: ${event.filename}:${event.lineno}:${event.colno}`
  console.error(`[renderer] uncaught error:${detail}`)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const detail =
    reason instanceof Error
      ? `\n  message: ${reason.message}\n  stack: ${reason.stack?.split('\n').slice(0, 6).join('\n')}`
      : `\n  reason: ${String(reason)}`
  console.error(`[renderer] unhandled rejection:${detail}`)
})

const app = createApp(App)

app.config.globalProperties.$notify = notify

app.use(pinia)
app.use(router)
app.mount('#app')
