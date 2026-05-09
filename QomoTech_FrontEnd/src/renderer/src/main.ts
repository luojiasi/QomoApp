import './main.css'
import '@resources/iconfont/iconfont.js'

import { applySavedTheme } from './composables/useAppColorScheme'
import { notify } from './composables/useNotification'
import pinia from './stores/pinia'
import App from './App.vue'
import router from './router'
import { startGlobalCameraReceiver } from './api/cameraReceiver'
import { createApp } from 'vue'

applySavedTheme()
// 相机首次与后端进行连接
startGlobalCameraReceiver()

const app = createApp(App)

app.config.globalProperties.$notify = notify

app.use(pinia)
app.use(router)
app.mount('#app')
