import './main.css'
import '@resources/iconfont/iconfont.js'

import { applySavedTheme } from '@/shared/composables/useAppColorScheme'
import { notify } from '@/shared/composables/useNotification'
import pinia from '@/stores/pinia'
import App from './App.vue'
import router from './router'
import { startGlobalCameraReceiver } from '@/modules/camera/useCameraReceiver'
import { startHardwareMonitor } from '@/shared/api/hardware'
import { createApp } from 'vue'

applySavedTheme()
// 相机首次与后端进行连接
startGlobalCameraReceiver()
// 硬件状态监控（WS 驱动）
startHardwareMonitor()

const app = createApp(App)

app.config.globalProperties.$notify = notify

app.use(pinia)
app.use(router)
app.mount('#app')
