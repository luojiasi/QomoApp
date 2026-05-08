import type { RouteShortcut } from '../types/settings'

/** 设备功能相关页面的导航项（与 vue-router 路由 path 对应） */
export const deviceFeatureRoutes: RouteShortcut[] = [
  {
    path: '/controller-settings',
    name: '控制器',
    title: 'icon-touyingyi',
    description: '面向 ZMC406-V2 的通讯、轴参数与限位回零参数预设页面。'
  },
  {
    path: '/recipe-management',
    name: '配方',
    title: 'icon-biaoge',
    description: '用于承接配方列表、版本切换、参数模板和发布流程。'
  },
  {
    path: '/create-5p',
    name: '5P',
    title: 'icon-gongzuotai',
    description: '用于5P编辑器的页面。'
  },
  {
    path: '/help',
    name: '帮助',
    title: 'icon-bangzhu',
    description: '承接原 Home 的授权信息、账号维护与管理员操作内容。'
  },
  {
    path: '/production',
    name: '产量',
    title: 'icon-fuwuyunying',
    description: '预留给系统配置、日志审计或维护工具类界面。'
  },
  {
    path: '/self-process',
    name: '自定流程',
    title: 'icon-biaoge',
    description: '用于自定义流程的页面。'
  },
]
