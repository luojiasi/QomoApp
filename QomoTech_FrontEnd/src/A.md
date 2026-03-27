# QomoTech_FrontEnd `src` 文件用途总览

本文档汇总 `QomoTech_FrontEnd/src` 下所有目录与文件的主要用途，便于快速定位代码职责。

## `main/`（Electron 主进程）

- `main/index.ts`：应用主入口，创建窗口、注册 IPC（窗口控制、授权、JSON 保存）并启动授权监控。
- `main/device.ts`：生成设备指纹（主机信息、MachineGuid、BIOS UUID、MAC）并做 SHA-256 哈希。
- `main/license.ts`：离线授权核心逻辑（密钥解析、签名校验、设备绑定、到期/回拨检测、授权文件读写）。
- `main/types/license.ts`：主进程授权相关常量与类型定义（状态码、载荷、激活结果）。

## `preload/`（预加载桥接层）

- `preload/index.ts`：通过 `contextBridge` 暴露渲染层可用 API（授权接口、保存 JSON 接口）。
- `preload/index.d.ts`：补充 `window.api`/`window.electron` 的全局类型声明，约束渲染层调用。

## `renderer/`（渲染进程入口层）

- `renderer/index.html`：渲染进程 HTML 入口，包含 CSP 与 `#app` 挂载点。

## `renderer/src/`（Vue 前端应用）

- `renderer/src/main.ts`：Vue 应用启动入口，注册 Pinia、Router、主题与全局通知。
- `renderer/src/App.vue`：应用根组件，承载窗口按钮、全局通知容器、路由视图与授权轮询守卫。
- `renderer/src/main.css`：全局样式与主题变量（亮/暗色、通用卡片与输入样式）。
- `renderer/src/env.d.ts`：Vue 全局属性类型扩展（`$notify`）。
- `renderer/src/router.ts`：路由定义与全局前置守卫（授权与登录态联动跳转）。

## `renderer/src/components/`（可复用组件）

- `renderer/src/components/RouteTabs.vue`：顶部导航标签组件（功能页路由切换 + 主题切换入口）。
- `renderer/src/components/HomeUserBar.vue`：首页用户信息条（角色显示与退出登录）。
- `renderer/src/components/NotificationToast.vue`：全局通知弹层（多类型消息、自动关闭、进度条）。
- `renderer/src/components/A.md`：`components` 目录说明文档。

## `renderer/src/composables/`（组合式逻辑）

- `renderer/src/composables/useAppColorScheme.ts`：主题读取/切换与本地持久化逻辑。
- `renderer/src/composables/useNotification.ts`：全局通知能力封装（注册、推送、清空、快捷方法）。
- `renderer/src/composables/useSettingsPages.ts`：设置页聚合逻辑（导航、sections 组装、保留页访问）。
- `renderer/src/composables/A.md`：`composables` 目录说明文档。

## `renderer/src/configs/`（配置与默认数据工厂）

- `renderer/src/configs/settings.ts`：统一导出导航、保留页定义及各业务配置模块。
- `renderer/src/configs/router.ts`：设备功能导航快捷项配置（与页面路由 path 对应）。
- `renderer/src/configs/controllerSettings.ts`：控制器默认参数、轴数量裁剪逻辑、页面 section 构建器。
- `renderer/src/configs/recipeSettings.ts`：配方默认状态、配方创建工厂、主配方详情 section 构建器。
- `renderer/src/configs/rs232Settings.ts`：RS232 选项常量、默认工作台状态、API 协议描述与 section 构建器。
- `renderer/src/configs/A.md`：`configs` 目录说明文档。

## `renderer/src/stores/`（Pinia 状态管理）

- `renderer/src/stores/pinia.ts`：Pinia 实例创建与导出。
- `renderer/src/stores/auth.ts`：登录与身份状态管理（管理员/普通用户、本地账号持久化）。
- `renderer/src/stores/license.ts`：授权状态管理（刷新状态、激活、清空、同步设备指纹）。
- `renderer/src/stores/settings.ts`：保留页面配置状态读取。
- `renderer/src/stores/settingsStoreUtils.ts`：设置类 store 的统一保存结果构造工具。
- `renderer/src/stores/controllerSettingsStore.ts`：控制器参数状态、本地存储持久化、轴数量切换。
- `renderer/src/stores/recipeSettingsStore.ts`：配方管理状态、本地存储读写、配方增删与选择操作。
- `renderer/src/stores/rs232WorkbenchStore.ts`：RS232 工作台状态、本地持久化与显式保存。
- `renderer/src/stores/A.md`：`stores` 目录说明文档。

## `renderer/src/types/`（类型定义）

- `renderer/src/types/settings.ts`：跨模块核心设置类型聚合（sections、路由项、保存结果等）。
- `renderer/src/types/controllerSettings.ts`：控制器参数模型类型（通讯、轴、I/O）。
- `renderer/src/types/recipeSettings.ts`：配方体系类型（主配方、子配方、公式、筛选）。
- `renderer/src/types/rs232Settings.ts`：RS232 参数、请求/响应、会话与接口描述类型。
- `renderer/src/types/saveJson.ts`：保存 JSON 预设类型（与主进程 IPC 约定一致）。
- `renderer/src/types/auth.ts`：认证相关类型（账号、存储状态、登录结果）。
- `renderer/src/types/license.ts`：渲染层授权状态与激活结果类型。
- `renderer/src/types/notification.ts`：通知组件与调用参数类型。
- `renderer/src/types/A.md`：`types` 目录说明文档。

## `renderer/src/utils/`（工具函数）

- `renderer/src/utils/settings.ts`：设置对象深拷贝与字段展示格式化工具。
- `renderer/src/utils/A.md`：`utils` 目录说明文档。

## `renderer/src/view/`（页面视图）

- `renderer/src/view/Home.vue`：首页导航容器页（展示功能入口与用户栏）。
- `renderer/src/view/Login.vue`：登录页（先校验授权，再执行账号登录）。
- `renderer/src/view/License.vue`：离线授权页（展示状态/指纹，提交密钥激活）。
- `renderer/src/view/Help.vue`：帮助与维护页（授权信息、用户账号维护、管理员密钥操作）。
- `renderer/src/view/ControllerSettings.vue`：控制器参数设置页（通讯、轴参数、I/O 显示与导出）。
- `renderer/src/view/RecipeManagement.vue`：配方管理页（主配方与子配方编辑、筛选、详情导出）。
- `renderer/src/view/DetailedRs232Send.vue`：RS232 工作台页（串口参数、发送区、接收区、快捷命令与导出）。
- `renderer/src/view/ReserveWorkbenchC.vue`：备用工作台 C（预留工具区与日志区承载位）。
- `renderer/src/view/A.md`：`view` 目录说明文档。

