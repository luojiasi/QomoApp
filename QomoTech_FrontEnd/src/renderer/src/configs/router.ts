import type { RouteShortcut } from '../types/settings'

/** 设备功能相关页面的导航项（与 vue-router 路由 path 对应） */
export const deviceFeatureRoutes: RouteShortcut[] = [
  {
    path: '/help',
    name: 'help',
    title: '帮助界面',
    description: '承接原 Home 的授权信息、账号维护与管理员操作内容。'
  },
  {
    path: '/controller-settings',
    name: 'controller-settings',
    title: '控制器参数设置',
    description: '面向 ZMC406-V2 的通讯、轴参数与限位回零参数预设页面。'
  },
  {
    path: '/camera-settings',
    name: 'camera-settings',
    title: '相机参数设置',
    description: '用于设置 OpenCV 相机参数、图像效果并保存本地存储。'
  },
  {
    path: '/recipe-management',
    name: 'recipe-management',
    title: '配方管理',
    description: '用于承接配方列表、版本切换、参数模板和发布流程。'
  },
  {
    path: '/detailed-rs232-send',
    name: 'detailed-rs232-send',
    title: '详细RS232数据发送区',
    description: '用于串口参数设置、帧编辑与 RS232 发送联调界面。'
  },
  {
    path: '/create-5p',
    name: 'create-5p',
    title: '5P 编辑器',
    description: '用于5P编辑器的页面。'
  },
  {
    path: '/reserve-workbench-c',
    name: 'reserve-workbench-c',
    title: '备用界面 C',
    description: '预留给系统配置、日志审计或维护工具类界面。'
  }
]
