import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useLicenseStore } from './stores/license'
import pinia from './stores/pinia'
import CameraSettings from './view/settings/CameraSettings.vue'
import ControllerSettings from './features/embedded-panels/ControllerSettings.vue'
import Help from './view/auth/Help.vue'
import Home from './view/Home.vue'
import License from './view/auth/License.vue'
import Login from './view/auth/Login.vue'
import RecipeManagement from './view/settings/RecipeManagement.vue'
import DetailedRs232Send from './features/embedded-panels/DetailedRs232Send.vue'
import Production from './view/Production.vue'
import { getDesktopBackendRuntimeStatus } from './api/core/desktopBridge'
import Create5P from './view/editor/Create5P.vue'
import SelfProcess from './view/editor/SelfProcess.vue'
import type { RouteShortcut } from './types/settings'

interface RouteMenuMeta {
  /** 菜单展示名 */
  label: string
  /** 图标类名 */
  icon: string
  /** 描述文案 */
  description: string
  /** 菜单内排序权重，越小越靠前 */
  order: number
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    menu?: RouteMenuMeta
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/license'
  },
  {
    path: '/license',
    name: 'license',
    component: License,
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/home',
    name: 'home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/controller-settings',
    name: 'controller-settings',
    component: ControllerSettings,
    meta: {
      requiresAuth: true,
      menu: {
        label: '控制器',
        icon: 'icon-touyingyi',
        description: '面向 ZMC406-V2 的通讯、轴参数与限位回零参数预设页面。',
        order: 10
      }
    }
  },
  {
    path: '/camera-settings',
    name: 'camera-settings',
    component: CameraSettings,
    meta: {
      requiresAuth: true,
      menu: {
        label: '相机',
        icon: 'icon-xiangji',
        description: '用于设置 OpenCV 相机参数、图像效果并保存本地存储。',
        order: 20
      }
    }
  },
  {
    path: '/recipe-management',
    name: 'recipe-management',
    component: RecipeManagement,
    meta: {
      requiresAuth: true,
      menu: {
        label: '配方',
        icon: 'icon-biaoge',
        description: '用于承接配方列表、版本切换、参数模板和发布流程。',
        order: 30
      }
    }
  },
  {
    path: '/detailed-rs232-send',
    name: 'detailed-rs232-send',
    component: DetailedRs232Send,
    meta: {
      requiresAuth: true,
      menu: {
        label: '激光',
        icon: 'icon-Point',
        description: '用于串口参数设置、帧编辑与 RS232 发送联调界面。',
        order: 40
      }
    }
  },
  {
    path: '/create-5p',
    name: 'create-5p',
    component: Create5P,
    meta: {
      requiresAuth: true,
      menu: {
        label: '5P',
        icon: 'icon-gongzuotai',
        description: '用于5P编辑器的页面。',
        order: 50
      }
    }
  },
  {
    path: '/help',
    name: 'help',
    component: Help,
    meta: {
      requiresAuth: true,
      menu: {
        label: '帮助',
        icon: 'icon-bangzhu',
        description: '承接原 Home 的授权信息、账号维护与管理员操作内容。',
        order: 60
      }
    }
  },
  {
    path: '/production',
    name: 'production',
    component: Production,
    meta: {
      requiresAuth: true,
      menu: {
        label: '产量',
        icon: 'icon-fuwuyunying',
        description: '预留给系统配置、日志审计或维护工具类界面。',
        order: 70
      }
    }
  },
  {
    path: '/self-process',
    name: 'self-process',
    component: SelfProcess,
    meta: {
      requiresAuth: true,
      menu: {
        label: '自定流程',
        icon: 'icon-biaoge',
        description: '用于自定义流程的页面。',
        order: 80
      }
    }
  }
]

/** 设备功能菜单项（从路由表派生，按 meta.menu.order 排序） */
export const deviceFeatureRoutes: RouteShortcut[] = routes
  .filter((route): route is RouteRecordRaw & { path: string } =>
    typeof route.path === 'string' && Boolean(route.meta?.menu)
  )
  .map((route) => ({
    path: route.path,
    name: route.meta!.menu!.label,
    title: route.meta!.menu!.icon,
    description: route.meta!.menu!.description,
    order: route.meta!.menu!.order
  }))
  .sort((a, b) => a.order - b.order)
  .map(({ path, name, title, description }) => ({ path, name, title, description }))

const router = createRouter({
  history: createWebHashHistory(),
  routes
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
