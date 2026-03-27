# `renderer/src/` 目录说明（Vue 应用根目录）

Vue 3 + Vue Router + Pinia 应用的核心入口与全局资源所在目录。子目录均有各自的 **`A.md`**（`components/`、`composables/`、`configs/`、`stores/`、`types/`、`utils/`、`view/`）。

## 根目录文件一览

| 文件 | 用途 |
|------|------|
| `main.ts` | 创建应用、注册 Pinia/Router、应用主题、挂载 `#app` |
| `App.vue` | 根布局：窗口控制按钮、`NotificationToast`、`RouterView`、授权轮询 |
| `router.ts` | 路由表与 `beforeEach`（授权 + 登录态） |
| `main.css` | Tailwind 与 CSS 变量主题 |
| `env.d.ts` | Vite 引用、`vue` 模块扩展 `$notify` |
| `A.md` | 本说明文档 |

## `main.ts` — 用法

无需在业务中再次引用，除非新建第二个应用实例（一般不需要）。

```ts
// 启动顺序要点：applySavedTheme() → createApp(App) → use(pinia) → use(router) → mount
```

## `App.vue` — 用法

- 全局通知：在 `onMounted` 中 `registerNotificationToast`，与 `useNotification` / `$notify` 联动。
- 窗口按钮：向主进程发送 `window-control`（与 `main/index.ts` 中监听器对应）。

## `router.ts` — 用法

在组件中导航：

```ts
import { useRouter } from 'vue-router'

const router = useRouter()
await router.push({ name: 'home' })
await router.push('/license')
```

守卫逻辑：未授权 → `license`；已授权且访问 `license` → 按登录态跳转 `home`/`login`；需登录路由未登录 → `login`。

## `main.css` — 用法

使用预设 class：`app-page`、`app-card`、`app-text-primary`、`app-input` 等，主题由 `data-theme` 与 `useAppColorScheme` 控制。

## `env.d.ts` — 用法

为 Options API 或 `getCurrentInstance()` 使用 `$notify` 时提供类型；Composition API 可直接 `import { notify } from '@/composables/useNotification'`。

## 子目录导航

| 目录 | 说明文档 |
|------|----------|
| `components/` | 可复用 UI 组件 |
| `composables/` | 组合式函数 |
| `configs/` | 默认数据、sections 工厂、导航配置 |
| `stores/` | Pinia 状态 |
| `types/` | TS 类型 |
| `utils/` | 工具函数 |
| `view/` | 页面级路由视图 |
