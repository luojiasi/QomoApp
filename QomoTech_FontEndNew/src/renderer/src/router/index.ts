import { createRouter, createWebHashHistory } from 'vue-router'
import Monitor from '../pages/Monitor.vue'
import Control from '../pages/Control.vue'
import Recipes from '../pages/Recipes.vue'
import Serial from '../pages/Serial.vue'
import Settings from '../pages/Settings.vue'

const routes = [
  { path: '/', redirect: '/monitor' },
  { path: '/monitor', name: 'Monitor', component: Monitor },
  { path: '/control', name: 'Control', component: Control },
  { path: '/recipes', name: 'Recipes', component: Recipes },
  { path: '/serial', name: 'Serial', component: Serial },
  { path: '/settings', name: 'Settings', component: Settings }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
