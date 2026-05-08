import './main.css'
import '@resources/iconfont/iconfont.js'

import { applySavedTheme } from './composables/useAppColorScheme'
import { notify } from './composables/useNotification'
import pinia from './stores/pinia'
import App from './App.vue'
import router from './router'
import { createApp } from 'vue'

applySavedTheme()

const app = createApp(App)

app.config.globalProperties.$notify = notify

app.use(pinia)
app.use(router)
app.mount('#app')
