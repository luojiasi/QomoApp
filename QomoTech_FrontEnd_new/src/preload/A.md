# `preload/` 目录说明（预加载脚本）

在 Electron 中，预加载脚本运行在 **特殊上下文**：可访问部分 Node/Electron API，并通过 `contextBridge` 安全暴露给渲染进程。渲染层通过 **`window.api`** 与 **`window.electron`** 调用（类型见 `index.d.ts`）。

## 文件一览

| 文件 | 用途 |
|------|------|
| `index.ts` | 实现 `contextBridge.exposeInMainWorld`，绑定 IPC |
| `index.d.ts` | 声明全局 `Window` 上的 `api` / `electron`，供 TS 与 IDE 提示 |

## 渲染进程 TypeScript 用法

### 调用授权 API

```ts
// 任意 .vue / .ts（需在 Electron 内运行，浏览器无 window.api）
const status = await window.api.license.getStatus()
const result = await window.api.license.activate(licenseKey)
await window.api.license.clear()
const fp = await window.api.license.getDeviceFingerprint()
```

### 保存 JSON 到本地文件

与主进程 `app:save-json-file` 约定一致，`preset` 类型见 `renderer/src/types/saveJson.ts`。

```ts
import type { SaveJsonPreset } from '@/types/saveJson'

const preset: SaveJsonPreset = 'controller-settings'
const json = JSON.stringify(data, null, 2)
const res = await window.api.saveJsonToFile(preset, json)

if (res.ok) {
  console.log('保存到:', res.filePath)
} else if ('canceled' in res && res.canceled) {
  // 用户取消
} else {
  console.error(res.error)
}
```

### 使用 electron-toolkit 封装

```ts
// 例如发送 IPC（窗口控制已在 App.vue 中使用）
window.electron?.ipcRenderer?.send('window-control', 'minimize')
```

## 扩展新 API 的步骤

1. 在 `main/index.ts` 注册 `ipcMain.handle('channel:name', handler)`  
2. 在 `preload/index.ts` 的 `RendererApi` 与 `api` 对象中增加方法  
3. 在 `preload/index.d.ts` 的 `declare global` 中同步类型  
4. 在业务代码中通过 `window.api.xxx` 调用  

## 注意事项

- `contextIsolation` 开启时，**不能**在渲染进程直接 `require('electron')`，必须通过此处暴露的 API。  
- 在纯浏览器预览 Vite 时，`window.api` 可能为 `undefined`，调用前应可选链或分支处理（参考相关业务组件）。
