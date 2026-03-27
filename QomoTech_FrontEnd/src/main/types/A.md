# `main/types/` 目录说明

存放 **主进程专用** 的 TypeScript 类型定义，供 `main/*.ts` 与 `preload/index.ts`（通过相对路径 `../main/types/license`）共享，避免渲染层与主进程授权结构不一致。

## 文件一览

| 文件 | 用途 |
|------|------|
| `license.ts` | 授权载荷、信封、激活记录、状态码、`LicenseStatus`、`LicenseActivationResult` 等 |

## TypeScript 用法

### 从主进程导入

```ts
// main/license.ts
import type { LicenseStatus, LicenseActivationResult } from './types/license'
```

### 从预加载脚本导入（类型与实现）

`preload/index.ts` 中：

```ts
import type { LicenseActivationResult, LicenseStatus } from '../main/types/license'
```

### 常量

文件中导出的 `LICENSE_VALID_DAYS`、`LICENSE_CHECK_INTERVAL_MS` 等可在主进程逻辑中引用，**不要**在纯 UI 层硬编码相同数值。

```ts
import { LICENSE_CHECK_INTERVAL_MS } from './types/license'
```

## 与 `renderer/src/types/license.ts` 的关系

两者描述对象形状应对齐（状态码、字段名）。若修改授权协议，需同步更新 **主进程类型**、**preload**、**渲染层 store** 三处。
