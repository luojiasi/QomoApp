import { createRouter, createWebHashHistory } from 'vue-router'
import Monitor from '../pages/Monitor.vue'
import Control from '../pages/Control.vue'
import ControllerSettings from '../pages/ControllerSettings.vue'
import Recipes from '../pages/Recipes.vue'
import FreeParam from '../pages/FreeParam.vue'
import Serial from '../pages/Serial.vue'
import Settings from '../pages/Settings.vue'

const routes = [
  { path: '/', redirect: '/monitor' },
  { path: '/monitor', name: 'Monitor', component: Monitor },
  { path: '/control', name: 'Control', component: Control },
  { path: '/controller-settings', name: 'ControllerSettings', component: ControllerSettings },
  { path: '/recipes', name: 'Recipes', component: Recipes },
  { path: '/free-param', name: 'FreeParam', component: FreeParam },
  { path: '/serial', name: 'Serial', component: Serial },
  { path: '/settings', name: 'Settings', component: Settings }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
