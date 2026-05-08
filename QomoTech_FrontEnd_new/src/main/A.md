# `main/` 目录说明（Electron 主进程）

本目录代码运行在 **Node.js + Electron 主进程** 环境，**不要**在渲染进程（Vue）中直接 `import` 这些文件；与界面通信通过 **IPC**（见 `preload/index.ts` 与 `main/index.ts`）。

## 文件一览

| 文件 | 用途 |
|------|------|
| `index.ts` | 应用入口：创建窗口、注册 IPC、加载渲染页 |
| `device.ts` | 采集本机信息并计算设备指纹（SHA-256） |
| `license.ts` | 离线授权：读写字典、验签、激活、过期与时间回拨检测 |
| `types/license.ts` | 主进程侧授权相关的 TypeScript 类型与常量 |

## `index.ts` — 用法说明

- **职责**：`app.whenReady()` 后创建 `BrowserWindow`、注册 `ipcMain`、调用 `startLicenseMonitor()`。
- **渲染层如何配合**：预加载脚本通过 `ipcRenderer.invoke` 调用此处注册的 channel（如 `license:get-status`）。

**主进程内扩展示例**（仅当你在 `main/` 内新增功能时）：

```ts
// main/index.ts（片段）
import { ipcMain } from 'electron'

ipcMain.handle('my-feature:ping', () => ({ ok: true, at: Date.now() }))
```

渲染层需在 `preload/index.ts` 暴露同名 invoke，并在 `preload/index.d.ts` 扩展 `window.api` 类型。

## `device.ts` — 用法说明

- **导出**：`getDeviceFingerprint(): string`
- **用途**：为授权绑定生成稳定设备标识；被 `license.ts` 引用。

```ts
import { getDeviceFingerprint } from './device'

const fp = getDeviceFingerprint()
```

## `license.ts` — 用法说明

- **主要导出**：`getLicenseStatus`、`activateLicense`、`clearLicense`、`getCurrentDeviceFingerprint`、`startLicenseMonitor`
- **存储位置**：`app.getPath('userData')` 下的 `license.json`

```ts
import { getLicenseStatus, activateLicense } from './license'

const status = await getLicenseStatus()
const result = await activateLicense(licenseKeyString)
```

## `types/license.ts` — 用法说明

- 定义 `LicenseStatus`、`LicenseStatusCode`、`SignedLicensePayload`、`ActivatedLicenseRecord` 等。
- **主进程**与 **preload** 的 `import type` 可共用此文件，保持类型一致。

```ts
import type { LicenseStatus } from './types/license'

function printStatus(s: LicenseStatus): void {
  console.log(s.code, s.message)
}
```

## 相关文档

- 预加载桥接：`../preload/A.md`
- 渲染层调用授权：`../renderer/src/stores/A.md`（`license` store）
