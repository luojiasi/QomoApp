# QomoTech 后台运行状态检测说明

本文说明桌面端（Electron）如何检测「后台」（Python 服务）是否可用，以及相关代码位置。

## 结论摘要

- **在线判定**：主进程对 **`127.0.0.1:5000` 做 TCP 连接探测**（非 HTTP `/health`）。
- **连接成功** → 认为后台可达，`state === 'running'`。
- **其它展示状态**：在端口不可达时，结合 `run.exe` 是否存在、子进程是否在跑、是否在自动重启、启动错误文案等，组合成 `starting` / `restarting` / `error` / `missing` / `stopped`。

## 1. 主进程：端口探测

**文件**：`src/main/index.ts`

- 常量：`BACKEND_HOST = '127.0.0.1'`，`BACKEND_PORT = 5000`。
- 函数：`isBackendReachable()`  
  - 使用 Node `net.createConnection`。
  - 套接字超时 **1 秒**；`connect` 成功为 `true`，`error` / `timeout` 为 `false`。

启动流程中还会用 `waitForBackend()`：在超时时间内每隔约 500ms 重试 `isBackendReachable()`。

## 2. 主进程：聚合状态 `getBackendRuntimeStatus`

**文件**：`src/main/index.ts`

逻辑顺序（简化）：

1. 若 `isBackendReachable()` 为真 → 返回 `running`，`isReachable: true`。
2. 否则若找不到 `run.exe`（同目录或 `resources`）→ `missing`。
3. 否则若正在自动重启 → `restarting`。
4. 否则若仍有 `backendProcess` → `starting`（或附带 `backendStartupIssue` 文案）。
5. 否则若有启动错误信息 → `error`。
6. 否则 → `stopped`。

**IPC**：`ipcMain.handle('get-backend-runtime-status', …)` 返回上述结构。

## 3. Preload：暴露给渲染进程

**文件**：`src/preload/index.ts`

- `window.api.getBackendRuntimeStatus` → `ipcRenderer.invoke('get-backend-runtime-status')`。

## 4. 渲染进程封装

**文件**：`src/renderer/src/utils/desktopBridge.ts`

- `getDesktopBackendRuntimeStatus()`：调用 `window.api.getBackendRuntimeStatus()`。
- 若无桌面 API（例如非 Electron 环境），返回占位状态：`state: 'stopped'`，提示当前环境不支持。

## 5. 界面上的使用示例

### 登录页

**文件**：`src/renderer/src/views/Login.vue`

- `onMounted`：立即 `refreshBackendStatus()`，并 **每 2 秒** 轮询。
- 圆点颜色、文案由 `backendStatus.state` / `message` 驱动。
- 登录按钮：`backendStatus.state !== 'running'` 时禁用（与 TCP 探测一致）。

### 首页

**文件**：`src/renderer/src/views/Home.vue`

- 使用 `getDesktopBackendRuntimeStatus()` 做顶部「后台在线」圆点等展示，同样有定时刷新逻辑。

## 6. 注意点

| 现象 | 说明 |
|------|------|
| 显示「已成功打开」 | 仅表示 **5000 端口有进程在监听**，不校验是否为 Qomo 后端或 HTTP 是否正常。 |
| 端口被其它程序占用 | 可能被误判为后台已就绪。 |
| 纯浏览器 / 无 `window.api` | `desktopBridge` 返回不支持占位状态，与 Electron 打包行为不同。 |

## 相关文件一览

| 路径 | 作用 |
|------|------|
| `src/main/index.ts` | TCP 探测、`getBackendRuntimeStatus`、启动 `run.exe`、IPC |
| `src/preload/index.ts` | 暴露 `getBackendRuntimeStatus` |
| `src/renderer/src/utils/desktopBridge.ts` | 渲染进程统一入口 |
| `src/renderer/src/views/Login.vue` | 登录页轮询与 UI |
| `src/renderer/src/views/Home.vue` | 首页后台状态展示 |
