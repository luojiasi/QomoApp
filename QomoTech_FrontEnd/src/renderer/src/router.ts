import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useLicenseStore } from './stores/license'
import pinia from './stores/pinia'
import CameraSettings from './view/CameraSettings.vue'
import ControllerSettings from './view/ControllerSettings.vue'
import Help from './view/Help.vue'
import Home from './view/Home.vue'
import License from './view/License.vue'
import Login from './view/Login.vue'
import RecipeManagement from './view/RecipeManagement.vue'
import DetailedRs232Send from './view/DetailedRs232Send.vue'
import Production from './view/Production.vue'
import { getDesktopBackendRuntimeStatus } from './api/desktopBridge'
import Create5P from './view/Create5P.vue'
import SelfProcess from './view/SelfProcess.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/license'
    },
    {
      path: '/license',
      name: 'license',
      component: License,
      meta: {
        requiresAuth: false
      }
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: {
        requiresAuth: false
      }
    },
    {
      path: '/home',
      name: 'home',
      component: Home,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/controller-settings',
      name: 'controller-settings',
      component: ControllerSettings,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/camera-settings',
      name: 'camera-settings',
      component: CameraSettings,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/recipe-management',
      name: 'recipe-management',
      component: RecipeManagement,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/help',
      name: 'help',
      component: Help,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/detailed-rs232-send',
      name: 'detailed-rs232-send',
      component: DetailedRs232Send,
      meta: {
        requiresAuth: true
      }
    },{
      path: '/create-5p',
      name: 'create-5p',
      component: Create5P,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/production',
      name: 'production',
      component: Production,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/self-process',
      name: 'self-process',
      component: SelfProcess,
      meta: {
        requiresAuth: true
      }
    }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia)
  const licenseStore = useLicenseStore(pinia)
  const licenseStatus = await licenseStore.refreshStatus()

  if (!licenseStatus.valid) {
    authStore.logout()

    if (to.name !== 'license') {
      return { name: 'license' }
    }

    return true
  }

  if (to.name === 'license') {
    if (!authStore.isLoggedIn) {
      return { name: 'login' }
    }
    const backendStatus = await getDesktopBackendRuntimeStatus()
    return backendStatus.state === 'running' ? { name: 'home' } : { name: 'login' }
  }

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login' }
  }

  if (to.name === 'login' && authStore.isLoggedIn) {
    const backendStatus = await getDesktopBackendRuntimeStatus()
    return backendStatus.state === 'running' ? { name: 'home' } : true
  }

  return true
})

export default router
