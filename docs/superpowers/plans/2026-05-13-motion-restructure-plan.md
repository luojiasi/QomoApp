# Motion Module Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `modules/motion/` by file type/responsibility, strictly separate TS types from API implementations, extract Vue `<script>` logic into fine-grained composables.

**Architecture:** Four-phase approach. Phase 1 moves/renames files and strips types from API files — zero logic changes. Phase 2 splits `useProgramRunner`. Phase 3 extracts one composable per capability from each .vue panel. Phase 4 moves components/pages/panels to final locations. Each task verifies with `npm run typecheck`.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Electron + Vite

---

## File Structure Map

### Target directory layout

```
modules/motion/
├── api/                              pure HTTP/RPC calls, no type exports
│   ├── axis.ts                       (was axisApi.ts, stripped of types)
│   ├── bootstrap.ts                  (was bootstrapApi.ts, stripped of types)
│   ├── connect.ts                    (was connectApi.ts, stripped of types)
│   ├── io.ts                         (was ioApi.ts, stripped of types)
│   ├── motion.ts                     (was motionApi.ts — API helpers + constants for axis status)
│   ├── program.ts                    (was programApi.ts, stripped of types)
│   └── index.ts
├── types/                            interface/type ONLY source
│   ├── axis.ts                       MotionAxis, UAxisRotateRequestPayload, RAxisRotateRequestPayload
│   ├── bootstrap.ts                  BackendBootstrapResult
│   ├── connect.ts                    MotionAxisParamsPayload, MotionAllAxesParamsRequestPayload
│   ├── controller.ts                 (was motionTypes.ts — ControllerParameters etc.)
│   ├── io.ts                         MotionIoOutputState, MotionIoInputState
│   ├── motion.ts                     CommonOnlineCommand, AXIS_STATUS_BIT_DESCRIPTIONS type
│   ├── program.ts                    Product4PCenterRotationPayload, StartProgramStatusData, StartProgramControlAction
│   ├── auxiliary.ts                  XYZ
│   └── index.ts
├── stores/
│   ├── useControllerSettingsStore.ts (was useMotionStore.ts — renamed to match defineStore key)
│   ├── useAuxiliaryFunctionPanelStore.ts (was auxiliaryStore.ts)
│   └── index.ts
├── composables/
│   ├── useMotionExecute.ts           (extracted from motionApi.ts)
│   ├── useMotionKeyboard.ts          (moved, unchanged)
│   ├── useProgramRunner.ts           (orchestrator, composes below two)
│   ├── useProgramControl.ts          (pause/resume/reset/estop/skip)
│   ├── useProgramStatus.ts           (WebSocket status monitor + sync)
│   ├── useAxisJog.ts                 (relative/absolute/zero per axis, from ManualMotionPanel)
│   ├── useIoOutputs.ts               (IO toggle with busy tracking, from ControllerSettingsPage)
│   ├── useHome.ts                    (homing workflow, from OutputComponent)
│   ├── useControllerForm.ts          (form save/reset/connect/estop, from ControllerSettingsPage)
│   └── index.ts
├── config/
│   ├── controller.ts                 (was controllerConfig.ts)
│   ├── qomo5p.ts                     (was qomo5pConfig.ts)
│   └── index.ts
├── validation/
│   ├── controller.ts                 (was controllerValidation.ts)
│   └── index.ts
├── components/                       shared across modules
│   └── ControlPanelBase.vue          (also used by laser/camera)
├── pages/                            route-mounted pages
│   ├── HomePage.vue
│   └── ControllerSettingsPage.vue
├── panels/                           composed into pages
│   ├── AuxiliaryPanel.vue
│   ├── DriverControlPanel.vue
│   ├── HomeUserBar.vue
│   ├── ManualMotionPanel.vue
│   ├── OutputComponent.vue
│   ├── StartProgramPanel.vue
│   └── TaskProgressAside.vue
└── index.ts                          top-level barrel
```

### Items NOT extracted (too large/specialized for Phase 3 — extracted in later PR if needed)

- **AuxiliaryPanel.vue** axis-center-calib workflow (~290 lines) and quick-focus (~85 lines): These are self-contained within one panel. Keeping them inline avoids a giant composable that's unused elsewhere. Extract separately in a follow-up.

---

### Task 1: Create directory structure

**Files:**
- Create: `api/`, `types/`, `stores/`, `composables/`, `config/`, `validation/`, `components/`, `pages/` subdirectories under `modules/motion/`

- [ ] **Step 1: Create all subdirectories**

```bash
cd D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion
mkdir api types stores composables config validation components pages
```

Expected: 8 directories created.

- [ ] **Step 2: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/api \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/types \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\stores \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\config \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\validation \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\components \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\pages
git commit -m "chore: create motion subdirectories for type-based reorganization"
```

---

### Task 2: Create types/ files and barrel

**Files:**
- Create: `types/axis.ts`, `types/bootstrap.ts`, `types/connect.ts`, `types/io.ts`, `types/motion.ts`, `types/program.ts`, `types/auxiliary.ts`, `types/controller.ts`, `types/index.ts`
- Modify: `motionTypes.ts` (rename to types/controller.ts), `auxiliaryTypes.ts` (rename to types/auxiliary.ts)

- [ ] **Step 1: Write `types/axis.ts`**

Types stripped from `axisApi.ts`: `MotionAxis`, `UAxisRotateRequestPayload`, `RAxisRotateRequestPayload`

```typescript
// types/axis.ts
export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'

export interface UAxisRotateRequestPayload {
  旋转角度: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}

export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}
```

- [ ] **Step 2: Write `types/bootstrap.ts`**

```typescript
// types/bootstrap.ts
export interface BackendBootstrapResult {
  success: boolean
  message: string
  data?: { hardware?: any; motion?: any; params?: any }
}
```

- [ ] **Step 3: Write `types/connect.ts`**

```typescript
// types/connect.ts
export interface MotionAxisParamsPayload {
  units?: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  atype?: number
  merge?: number
  fwd_in?: number
  rev_in?: number
}

export interface MotionAllAxesParamsRequestPayload {
  table: Record<string, MotionAxisParamsPayload>
}
```

- [ ] **Step 4: Write `types/io.ts`**

```typescript
// types/io.ts
export interface MotionIoOutputState { io_no: number; value: boolean }
export interface MotionIoInputState { io_no: number; value: boolean }
```

- [ ] **Step 5: Write `types/motion.ts`**

```typescript
// types/motion.ts
export type CommonOnlineCommand = {
  description: string
  command: string
  usage: string
}
```

- [ ] **Step 6: Write `types/program.ts`**

```typescript
// types/program.ts
export interface Product4PCenterRotationPayload {
  Xoffset: number
  Yoffset: number
  Zoffset: number
}

export interface StartProgramStatusData { running: boolean; paused: boolean }

export type StartProgramControlAction = 'pause' | 'resume' | 'reset' | 'estop' | 'skip'
```

- [ ] **Step 7: Write `types/auxiliary.ts`** (same content as auxiliaryTypes.ts)

```typescript
// types/auxiliary.ts
/** 通用 XYZ 坐标 */
export type XYZ = {
  X: number
  Y: number
  Z: number
}
```

- [ ] **Step 8: Write `types/controller.ts`** (same content as motionTypes.ts)

Copy the entire content of `motionTypes.ts` into `types/controller.ts` (no changes to the types themselves).

- [ ] **Step 9: Write `types/index.ts` barrel**

```typescript
// types/index.ts
export * from './axis'
export * from './bootstrap'
export * from './connect'
export * from './io'
export * from './motion'
export * from './program'
export * from './auxiliary'
export * from './controller'
```

- [ ] **Step 10: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\types
git commit -m "feat: create motion types/ with interface-only files"
```

---

### Task 3: Strip types from API files and move to api/

**Files:**
- Create: `api/axis.ts`, `api/bootstrap.ts`, `api/connect.ts`, `api/io.ts`, `api/motion.ts`, `api/program.ts`, `api/index.ts`
- Modify: strip types from original files, remove old files after new ones created

- [ ] **Step 1: Write `api/axis.ts`** — copy `axisApi.ts` but remove line 4-18 (all type exports)

The file content: import lines unchanged, then directly the internal helpers (AXIS_NO_TO_NAME, isPositiveFiniteNumber, pickAxisSpeed) and API functions (getMotionPosition through rotateRAxisByTurns). Import MotionAxis, UAxisRotateRequestPayload, RAxisRotateRequestPayload from `../types/axis`.

```typescript
// api/axis.ts
import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { ControllerParameters } from '../types/controller'
import type { MotionAxis, UAxisRotateRequestPayload, RAxisRotateRequestPayload } from '../types/axis'

type MoveMotionAxisAbsOptions = { speed?: number; controllerSettings?: ControllerParameters }
type MoveMotionAxisRelOptions = { speed?: number; controllerSettings?: ControllerParameters }

const AXIS_NO_TO_NAME: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const pickAxisSpeed = (axisNo: number, options?: { speed?: number; controllerSettings?: ControllerParameters }): number | undefined => {
  const explicitSpeed = options?.speed
  if (isPositiveFiniteNumber(explicitSpeed)) return explicitSpeed
  const savedSpeed = options?.controllerSettings?.axes.find((a) => a.axis_no === axisNo)?.speed
  return isPositiveFiniteNumber(savedSpeed) ? savedSpeed : undefined
}

export const getMotionPosition = async (axis: MotionAxis): Promise<ApiCallResult<number>> =>
  apiCall<number>(`motion/dpos/${axis}`, 'GET')

export const emergencyStopMotion = async (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/estop', 'POST')

export const zeroMotionAxis = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[axisNo]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNo}` }
  return apiCall('motion/axis/zero', 'POST', { axis: axisName } as unknown as Record<string, unknown>)
}

export const moveMotionAxisAbs = async (axisNo: number, targetMm: number, options?: MoveMotionAxisAbsOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: targetMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall('motion/move/abs', 'POST', body as unknown as Record<string, unknown>)
}

export const moveMotionAxisRel = async (axisNo: number, deltaMm: number, options?: MoveMotionAxisRelOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: deltaMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall('motion/move/rel', 'POST', body as unknown as Record<string, unknown>)
}

export const rotateUAxisByAngle = async (payload: UAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/u/rotate-by-params', 'POST', { params: payload } as unknown as Record<string, unknown>)

export const rotateRAxisByTurns = async (payload: RAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/r/rotate-turns', 'POST', { params: payload } as unknown as Record<string, unknown>)
```

- [ ] **Step 2: Write `api/bootstrap.ts`** — copy `bootstrapApi.ts`, strip type, update imports

```typescript
// api/bootstrap.ts
import type { ControllerParameters } from '../types/controller'
import type { BackendBootstrapResult } from '../types/bootstrap'
import { defaultControllerParameters } from '../config/controller'
import { connectMotionWithControllerSettings, setMotionAllAxesParamsWithControllerSettings } from './connect'
import { isControllerConnected } from '@/shared/api/hardware'

let controllerBootstrapDone = false
let controllerBootstrapPromise: Promise<BackendBootstrapResult> | null = null

const reconnectControllerSingleton = async (controllerSettings: ControllerParameters): Promise<BackendBootstrapResult> => {
  const connectRes = await connectMotionWithControllerSettings(controllerSettings)
  if (!connectRes?.success) {
    return { success: false, message: connectRes?.message || '控制器连接失败，请检查硬件连接。', data: { motion: connectRes } }
  }

  const paramsRes = await setMotionAllAxesParamsWithControllerSettings(controllerSettings)
  if (!paramsRes?.success) {
    console.warn('[bootstrap] 连接成功但轴参数下发失败', paramsRes?.message)
    return { success: true, message: '已连接控制器，但轴参数下发失败。', data: { motion: connectRes, params: paramsRes } }
  }

  controllerBootstrapDone = true
  return { success: true, message: '已重连控制器并下发轴参数。', data: { motion: connectRes, params: paramsRes } }
}

export const bootstrapControllerOnce = async (controllerSettings: ControllerParameters = defaultControllerParameters): Promise<BackendBootstrapResult> => {
  if (controllerBootstrapDone && isControllerConnected()) {
    return { success: true, message: '控制器单实例已初始化，无需重复连接。' }
  }
  if (controllerBootstrapPromise) return controllerBootstrapPromise

  controllerBootstrapPromise = (async () => {
    if (isControllerConnected()) {
      controllerBootstrapDone = true
      return { success: true, message: '控制器已连接，跳过重复连接。' }
    }
    return reconnectControllerSingleton(controllerSettings)
  })()

  try {
    return await controllerBootstrapPromise
  } finally {
    controllerBootstrapPromise = null
  }
}
```

- [ ] **Step 3: Write `api/connect.ts`** — copy `connectApi.ts`, strip types, update imports

```typescript
// api/connect.ts
import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { ControllerParameters } from '../types/controller'
import type { MotionAxisParamsPayload, MotionAllAxesParamsRequestPayload } from '../types/connect'

const AXIS_NO_TO_NAME: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }

export function buildMotionConnectRequestPayload(controllerSettings: ControllerParameters): { ip: string } {
  return { ip: controllerSettings.communication.controller_ip }
}

export const connectMotion = async (payload: { ip: string }): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

export const connectMotionWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))

export function buildMotionAllAxesParamsRequestPayload(
  controllerSettings: ControllerParameters
): MotionAllAxesParamsRequestPayload {
  const table: Record<string, MotionAxisParamsPayload> = {}

  for (const a of controllerSettings.axes) {
    const axisName = AXIS_NO_TO_NAME[a.axis_no]
    if (!axisName) continue
    table[axisName] = {
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      atype: a.axis_type,
      merge: a.merge,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in
    }
  }

  return { table }
}

export const setMotionAllAxesParams = async (
  payload: MotionAllAxesParamsRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/params/batch', 'POST', payload as unknown as Record<string, unknown>)

export const setMotionAllAxesParamsWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams(buildMotionAllAxesParamsRequestPayload(controllerSettings))

export const getControllerSettingsFromFile = async (): Promise<ApiCallResult<Record<string, unknown> | null>> =>
  apiCall('motion/controller-settings', 'GET')

export const saveControllerSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/controller-settings', 'POST', payload)
```

- [ ] **Step 4: Write `api/io.ts`** — copy `ioApi.ts`, strip types, update imports

```typescript
// api/io.ts
import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { MotionIoOutputState, MotionIoInputState } from '../types/io'

export const setMotionIoOutput = async (ioNo: number, value: boolean): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/io/output', 'POST', { io: ioNo, value } as unknown as Record<string, unknown>)

export const getMotionIoOutput = async (ioNo: number): Promise<ApiCallResult<MotionIoOutputState>> => {
  const res = await apiCall<boolean>(`motion/io/output/${Number(ioNo)}`, 'GET')
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : res as unknown as ApiCallResult<MotionIoOutputState>
}

export const getMotionIoOutputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/output', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })

export const getMotionIoInput = async (ioNo: number): Promise<ApiCallResult<MotionIoInputState>> => {
  const res = await apiCall<boolean>(`motion/io/input/${Number(ioNo)}`, 'GET')
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : res as unknown as ApiCallResult<MotionIoInputState>
}

export const getMotionIoInputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/input', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })
```

- [ ] **Step 5: Write `api/program.ts`** — copy `programApi.ts`, strip types, update imports

```typescript
// api/program.ts
import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { Product4PCenterRotationPayload, StartProgramControlAction } from '../types/program'

export const startProgram = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram', 'POST', payload)

export const syncProduct4PCenterRotation = async (payload: Product4PCenterRotationPayload): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'POST', payload as unknown as Record<string, unknown>)

export const getProduct4PCenterRotation = async (): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'GET')

export const getStartProgramStatus = async (): Promise<ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>> =>
  apiCall('startProgram/status', 'GET')

export const startProgramControl = async (action: StartProgramControlAction): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram/control', 'POST', { action } as unknown as Record<string, unknown>)
```

- [ ] **Step 6: Write `api/motion.ts`** — from `motionApi.ts`, keep constants + helpers only (no types, no composable)

Copy lines 1-127 from motionApi.ts (everything before `useMotionExecute`), but:
- Move `CommonOnlineCommand` type import to `../types/motion`
- Keep `AXIS_STATUS_BIT_DESCRIPTIONS`, `commonOnlineCommandsData`, and all helper functions

```typescript
// api/motion.ts
import type { CommonOnlineCommand } from '../types/motion'
import { apiCall } from '@/shared/api/httpClient'

// ... AXIS_STATUS_BIT_DESCRIPTIONS, commonOnlineCommandsData, helper functions (lines 15-127)
```

- [ ] **Step 7: Write `api/index.ts` barrel**

```typescript
// api/index.ts
export * from './axis'
export * from './bootstrap'
export * from './connect'
export * from './io'
export * from './motion'
export * from './program'
```

- [ ] **Step 8: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\api
git commit -m "feat: create motion api/ with type-free API functions"
```

---

### Task 4: Move config, validation, stores to subdirectories

**Files:**
- Create: `config/controller.ts`, `config/qomo5p.ts`, `config/index.ts`
- Create: `validation/controller.ts`, `validation/index.ts`
- Create: `stores/useControllerSettingsStore.ts`, `stores/useAuxiliaryFunctionPanelStore.ts`, `stores/index.ts`

- [ ] **Step 1: Copy `controllerConfig.ts` → `config/controller.ts`** with updated imports

The file content stays exactly the same except import paths change:
- `from './motionTypes'` → `from '../types/controller'`
- `from '@/shared/constants/constants'` stays
- `from '@/shared/types'` stays
- `from '@/shared/utils/settings'` stays

- [ ] **Step 2: Copy `qomo5pConfig.ts` → `config/qomo5p.ts`** (no import path changes needed)

- [ ] **Step 3: Write `config/index.ts`**

```typescript
export * from './controller'
export * from './qomo5p'
```

- [ ] **Step 4: Copy `controllerValidation.ts` → `validation/controller.ts`** with updated imports

Change:
- `from './motionTypes'` → `from '../types/controller'`
- `from './controllerConfig'` → `from '../config/controller'`

- [ ] **Step 5: Write `validation/index.ts`**

```typescript
export * from './controller'
```

- [ ] **Step 6: Copy `useMotionStore.ts` → `stores/useControllerSettingsStore.ts`** with updated imports

Change:
- `from './controllerConfig'` → `from '../config/controller'`
- `from './motionTypes'` → `from '../types/controller'`
- `from '@/modules/motion/connectApi'` → `from '../api/connect'`
- `from './controllerValidation'` → `from '../validation/controller'`
- Everything else stays the same. File already uses `useControllerSettingsStore` as the export name.

- [ ] **Step 7: Copy `auxiliaryStore.ts` → `stores/useAuxiliaryFunctionPanelStore.ts`** with updated imports

Change:
- `from './auxiliaryTypes'` → `from '../types/auxiliary'`

- [ ] **Step 8: Write `stores/index.ts`**

```typescript
export { useControllerSettingsStore } from './useControllerSettingsStore'
export { useAuxiliaryFunctionPanelStore } from './useAuxiliaryFunctionPanelStore'
```

- [ ] **Step 9: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\config \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\validation \
        D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\stores
git commit -m "feat: move config/validation/stores into motion subdirectories"
```

---

### Task 5: Create top-level motion/index.ts barrel + update ALL imports

**Files:**
- Create: `modules/motion/index.ts` (new top-level barrel)
- Modify: All 15 files that import from motion/ (internal + external)

- [ ] **Step 1: Write top-level `motion/index.ts`**

```typescript
// modules/motion/index.ts — top-level barrel
export * from './api'
export * from './types'
export * from './stores'
export * from './composables'
export * from './config'
export * from './validation'
```

- [ ] **Step 2: Update all external import paths**

Run a global search-replace across the codebase for each old path → new path:

| Old import | New import |
|---|---|
| `from '@/modules/motion/indexApi'` | `from '@/modules/motion/api'` |
| `from '@/modules/motion/useMotionStore'` | `from '@/modules/motion/stores/useControllerSettingsStore'` |
| `from '@/modules/motion/auxiliaryStore'` | `from '@/modules/motion/stores/useAuxiliaryFunctionPanelStore'` |
| `from '@/modules/motion/useMotionKeyboard'` | `from '@/modules/motion/composables/useMotionKeyboard'` |
| `from '@/modules/motion/useProgramRunner'` | `from '@/modules/motion/composables/useProgramRunner'` |
| `from '@/modules/motion/ioApi'` | `from '@/modules/motion/api/io'` |
| `from '@/modules/motion/motionTypes'` | `from '@/modules/motion/types/controller'` |
| `from '@/modules/motion/controllerConfig'` | `from '@/modules/motion/config/controller'` |
| `from '@/modules/motion/controllerValidation'` | `from '@/modules/motion/validation/controller'` |
| `from './controllerConfig'` | `from '../config/controller'` |
| `from './motionTypes'` | `from '../types/controller'` |
| `from './useMotionStore'` | `from '../stores/useControllerSettingsStore'` |
| `from './auxiliaryStore'` | `from '../stores/useAuxiliaryFunctionPanelStore'` |
| `from './auxiliaryTypes'` | `from '../types/auxiliary'` |
| `from './indexApi'` | `from '../api'` |
| `from './connectApi'` | `from '../api/connect'` |
| `from './controllerValidation'` | `from '../validation/controller'` |
| `from './ioApi'` | `from '../api/io'` |
| `from './HomeUserBar.vue'` | `from '../panels/HomeUserBar.vue'` |
| `from './panels/AuxiliaryPanel.vue'` | Already correct (panels/ stays) |
| `from '@/modules/motion/panels/ControlPanelBase.vue'` | `from '@/modules/motion/components/ControlPanelBase.vue'` |
| `from './ControlPanelBase.vue'` | `from '../components/ControlPanelBase.vue'` |
| `from './OutputComponent.vue'` | Already correct (same dir) |
| `from './panels/ControllerSettingsPage.vue'` | `from '../pages/ControllerSettingsPage.vue'` |

**Files to modify (external consumers):**
- `app/App.vue` — update `from '@/modules/motion/...'` imports
- `app/router.ts` — update `ControllerSettingsPage` import
- `modules/workflow/MotionController.vue` — update imports
- `modules/settings/useSettingsPages.ts` — update imports
- `modules/editor/useQomo5PStore.ts` — update imports
- `modules/camera/CameraControlPanel.vue` — `ControlPanelBase` import
- `modules/laser/LaserControlPanel.vue` — `ControlPanelBase` import

**Files to modify (internal consumers):**
- `HomePage.vue` — all imports
- `HomeUserBar.vue` — if any imports
- `panels/AuxiliaryPanel.vue` — all imports
- `panels/ControllerSettingsPage.vue` — all imports
- `panels/DriverControlPanel.vue` — all imports
- `panels/ManualMotionPanel.vue` — all imports
- `panels/OutputComponent.vue` — all imports
- `useMotionKeyboard.ts` — all imports
- `useProgramRunner.ts` — all imports

- [ ] **Step 3: Run typecheck to verify**

```bash
cd D:\Qomo\QomoTech\QomoTech_FrontEnd
npm run typecheck
```

Expected: PASS (all imports resolve correctly).

- [ ] **Step 4: Delete old files**

```bash
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/axisApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/bootstrapApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/connectApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/ioApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/motionApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/programApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/indexApi.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/motionTypes.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/auxiliaryTypes.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/controllerConfig.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/qomo5pConfig.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/controllerValidation.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/useMotionStore.ts
rm D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion/auxiliaryStore.ts
```

- [ ] **Step 5: Run typecheck again**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: reorganize motion module — separate types/api/stores/config/validation, update all imports"
```

---

### Task 6: Move useMotionExecute to composables/

**Files:**
- Create: `composables/useMotionExecute.ts`
- Modify: `ControllerSettingsPage.vue` — update import

- [ ] **Step 1: Write `composables/useMotionExecute.ts`**

Extract the `useMotionExecute` function (lines 129-188 of original motionApi.ts) into its own file, with proper imports.

```typescript
// composables/useMotionExecute.ts
import { ref } from 'vue'
import { apiCall } from '@/shared/api/httpClient'
import type { CommonOnlineCommand } from '../types/motion'
import {
  AXIS_STATUS_BIT_DESCRIPTIONS,
  commonOnlineCommandsData,
  resolveOnlineCommandResultText,
  isAxisStatusCommand,
  parseAxisStatusValue,
  formatAxisStatusAnalysis,
  formatOnlineCommandResultByCommand
} from '../api/motion'

type UseMotionExecuteOptions = {
  success?: (title: string, message?: string) => void
  error?: (title: string, message?: string) => void
}

export function useMotionExecute(options: UseMotionExecuteOptions = {}) {
  const onlineCommandInput = ref('')
  const onlineCommandResult = ref('')
  const onlineCommandPending = ref(false)
  const commonOnlineCommands = commonOnlineCommandsData
  const selectedCommonOnlineCommand = ref<CommonOnlineCommand | null>(null)

  function applyCommonOnlineCommand(item: CommonOnlineCommand): void {
    onlineCommandInput.value = item.command
    selectedCommonOnlineCommand.value = item
  }

  async function handleSendOnlineCommand(): Promise<void> {
    const command = onlineCommandInput.value.trim()
    if (!command) {
      options.error?.('在线命令为空', '请输入在线命令后再发送')
      return
    }

    onlineCommandPending.value = true
    try {
      const res = await apiCall<Record<string, unknown> | string>(
        'motion/cmd',
        'POST',
        { command } as Record<string, unknown>
      )
      if (!res?.success) {
        const rawText = resolveOnlineCommandResultText(res?.data, res?.message ?? '在线命令执行失败')
        onlineCommandResult.value = formatOnlineCommandResultByCommand(command, rawText)
        return
      }

      const rawText = resolveOnlineCommandResultText(res?.data, res?.message ?? '在线命令执行成功')
      onlineCommandResult.value = formatOnlineCommandResultByCommand(command, rawText)
      options.success?.('在线命令已发送', '执行成功')
    } finally {
      onlineCommandPending.value = false
    }
  }

  async function handleOpenOnlineCommandDoc(): Promise<void> {
    const res = await window.api.openDocument('resources/RTBasic.chm')
    if (!res.ok) {
      options.error?.('打开文档失败', res.error)
      return
    }
    options.success?.('已打开文档', 'RTBasic.chm')
  }

  return {
    onlineCommandInput,
    onlineCommandResult,
    onlineCommandPending,
    commonOnlineCommands,
    selectedCommonOnlineCommand,
    applyCommonOnlineCommand,
    handleSendOnlineCommand,
    handleOpenOnlineCommandDoc
  }
}
```

Also update `api/motion.ts` to export the helper functions so the composable can import them:
- `resolveOnlineCommandResultText`
- `formatOnlineCommandResultByCommand`

These are already defined in api/motion.ts; just make sure they're exported.

- [ ] **Step 2: Update `ControllerSettingsPage.vue`** import

Change:
```typescript
import { useMotionExecute } from '@/modules/motion/indexApi'
```
to:
```typescript
import { useMotionExecute } from '@/modules/motion/composables/useMotionExecute'
```

- [ ] **Step 3: Update `api/motion.ts`** to export helpers

Add explicit `export` to the helper functions that were previously internal:
- `resolveOnlineCommandResultText` → add `export`
- `formatAxisStatusAnalysis` → add `export`
- `formatOnlineCommandResultByCommand` → add `export`

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables\useMotionExecute.ts
git add -u
git commit -m "refactor: extract useMotionExecute composable from motionApi.ts"
```

---

### Task 7: Split useProgramRunner into 3 composables

**Files:**
- Create: `composables/useProgramStatus.ts`, `composables/useProgramControl.ts`
- Modify: `composables/useProgramRunner.ts`

- [ ] **Step 1: Write `composables/useProgramStatus.ts`**

Extract WebSocket + status monitoring logic from `useProgramRunner.ts`:

```typescript
// composables/useProgramStatus.ts
import { ref } from 'vue'
import { getStartProgramStatusWsUrl } from '@/shared/api/wsClient'
import { getStartProgramStatus } from '../api/program'

type StartProgramStatusPayload = {
  running?: boolean
  paused?: boolean
  total_tasks?: number
  current_task_index?: number
  进度百分比?: number
}

export function useProgramStatus() {
  let programStatusWs: WebSocket | null = null
  let programStatusWsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  let programStatusWsReconnectEnabled = true

  const programRunning = ref(false)
  const programPaused = ref(false)
  const programTaskCount = ref(0)
  const currentTaskIndex = ref(0)
  const currentTaskJindubaifenbi = ref(0)

  function applyStartProgramStatusPayload(data: StartProgramStatusPayload | undefined): void {
    if (!data) return
    if (typeof data.running === 'boolean') {
      programRunning.value = data.running
      programPaused.value = Boolean(data.paused)
    }
    if (typeof data.total_tasks === 'number') programTaskCount.value = Math.max(0, Math.floor(data.total_tasks))
    if (typeof data.current_task_index === 'number') {
      currentTaskIndex.value = Math.max(0, Math.floor(data.current_task_index))
    }
    if (typeof data.进度百分比 === 'number') currentTaskJindubaifenbi.value = Math.max(0, data.进度百分比)

    if (data.running === false) {
      programPaused.value = false
    }
  }

  function stopProgramStatusWebSocket(): void {
    programStatusWsReconnectEnabled = false
    if (programStatusWsReconnectTimer !== null) {
      clearTimeout(programStatusWsReconnectTimer)
      programStatusWsReconnectTimer = null
    }
    if (programStatusWs) {
      programStatusWs.onclose = null
      programStatusWs.onerror = null
      programStatusWs.onmessage = null
      programStatusWs.close()
      programStatusWs = null
    }
  }

  function scheduleProgramStatusWebSocketReconnect(): void {
    if (!programStatusWsReconnectEnabled) return
    if (programStatusWsReconnectTimer !== null) return
    programStatusWsReconnectTimer = setTimeout(() => {
      programStatusWsReconnectTimer = null
      connectProgramStatusWebSocket()
    }, 2000)
  }

  function connectProgramStatusWebSocket(): void {
    if (!programStatusWsReconnectEnabled || typeof WebSocket === 'undefined') return
    if (programStatusWs && programStatusWs.readyState === WebSocket.OPEN) return

    if (programStatusWs) {
      programStatusWs.onclose = null
      programStatusWs.onerror = null
      programStatusWs.onmessage = null
      programStatusWs.close()
      programStatusWs = null
    }

    const url = getStartProgramStatusWsUrl()
    try {
      const ws = new WebSocket(url)
      programStatusWs = ws
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; data?: unknown }
          if (msg.type !== 'start_program_status') return
          if (!msg.data || typeof msg.data !== 'object') return
          applyStartProgramStatusPayload(msg.data as StartProgramStatusPayload)
        } catch {
          // ignore non-JSON
        }
      }
      ws.onclose = () => {
        programStatusWs = null
        scheduleProgramStatusWebSocketReconnect()
      }
      ws.onerror = () => {
        try { ws.close() } catch { /* ignore */ }
      }
    } catch {
      scheduleProgramStatusWebSocketReconnect()
    }
  }

  async function syncProgramStatusOnEnter(): Promise<void> {
    const st = await getStartProgramStatus()
    if (!st?.success) return
    const data = st.data as StartProgramStatusPayload | undefined
    applyStartProgramStatusPayload(data)
  }

  function init(): void {
    programStatusWsReconnectEnabled = true
  }

  async function initSync(): Promise<void> {
    try {
      await syncProgramStatusOnEnter()
    } catch {
      // ignore enter sync errors
    }
    connectProgramStatusWebSocket()
  }

  function cleanup(): void {
    stopProgramStatusWebSocket()
  }

  return {
    programRunning,
    programPaused,
    programTaskCount,
    currentTaskIndex,
    currentTaskJindubaifenbi,
    init,
    initSync,
    cleanup
  }
}
```

- [ ] **Step 2: Write `composables/useProgramControl.ts`**

Extract control actions:

```typescript
// composables/useProgramControl.ts
import { type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { startProgramControl } from '../api/program'

export function useProgramControl(
  programRunning: Ref<boolean>,
  programPaused: Ref<boolean>,
  programTaskCount: Ref<number>,
  onAfterEstop: () => void
) {
  const { error, success } = useNotification()

  async function onPauseToggleClick(): Promise<void> {
    if (!programRunning.value) {
      error('当前没有运行中的程序。')
      return
    }
    const action = programPaused.value ? 'resume' : 'pause'
    const r = await startProgramControl(action)
    if (!r?.success) {
      error(r?.message || '暂停/继续操作失败。')
      return
    }
    success(r?.message || '已执行。')
  }

  async function onResetAlarmsClick(): Promise<void> {
    const r = await startProgramControl('reset')
    if (!r?.success) {
      error(r?.message || '复位清除报警失败。')
      return
    }
    success(r?.message || '报警已清除。')
  }

  async function onEstopClick(): Promise<void> {
    const r = await startProgramControl('estop')
    if (!r?.success) {
      error(r?.message || '急停指令失败。')
      return
    }
    success(r?.message || '已急停。')
    onAfterEstop()
  }

  async function onSkipTaskClick(): Promise<void> {
    if (programTaskCount.value < 2) return
    const r = await startProgramControl('skip')
    if (!r?.success) {
      error(r?.message || '跳过当前任务失败。')
      return
    }
    success(r?.message || '已请求跳过。')
  }

  return {
    onPauseToggleClick,
    onResetAlarmsClick,
    onEstopClick,
    onSkipTaskClick
  }
}
```

- [ ] **Step 3: Rewrite `composables/useProgramRunner.ts`** — slimmed orchestrator

```typescript
// composables/useProgramRunner.ts
import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'
import { useHardwareState } from '@/shared/api/hardware'
import { startProgram } from '../api/program'
import { useProgramStatus } from './useProgramStatus'
import { useProgramControl } from './useProgramControl'
import type { QomoEntityWithSurface } from '@/modules/editor/qomo5pTypes'

type XYMotionOffset = { x: number; y: number }

const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'

export function useProgramRunner() {
  const { error, success } = useNotification()
  const qomo5pStore = useQomo5PStore()
  const { mposition: wsMposition } = useHardwareState()

  const programStartedAtMs = ref<number | null>(null)
  const programElapsedMs = ref(0)
  const currentRunRecipePayload = ref<Record<string, unknown> | null>(null)
  const recipeUpperOpeningMm = ref<number | null>(null)
  const homeXyOffset = ref<XYMotionOffset>({ x: 0, y: 0 })
  const runTrigger = ref(false)

  let programElapsedTimer: ReturnType<typeof setInterval> | null = null

  const {
    programRunning,
    programPaused,
    programTaskCount,
    currentTaskIndex,
    currentTaskJindubaifenbi,
    init: initStatus,
    initSync: initStatusSync,
    cleanup: cleanupStatus
  } = useProgramStatus()

  const afterEstop = () => {
    runTrigger.value = false
    currentTaskIndex.value = 0
    currentTaskJindubaifenbi.value = 0
    stopProgramElapsedTimer()
    if (programStartedAtMs.value) programElapsedMs.value = Math.max(0, Date.now() - programStartedAtMs.value)
    programStartedAtMs.value = null
    persistProgramStartedAtToStorage(null)
  }

  const {
    onPauseToggleClick,
    onResetAlarmsClick,
    onEstopClick,
    onSkipTaskClick
  } = useProgramControl(programRunning, programPaused, programTaskCount, afterEstop)

  // ... (remaining helper functions: formatElapsedMs, programElapsedText, timer management,
  //      entity offset, onRunClick, handleRunRecipeChange, handleUpperOpeningChange, etc.)

  // Same return interface as before
}
```

The key insight: `useProgramRunner` becomes the orchestrator that composes `useProgramStatus` and `useProgramControl`, adds timer + recipe + entity-offset logic. It returns the same public API so `HomePage.vue` destructuring stays unchanged.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables
git commit -m "refactor: split useProgramRunner into useProgramRunner + useProgramControl + useProgramStatus"
```

---

### Task 8: Extract useAxisJog composable from ManualMotionPanel

**Files:**
- Create: `composables/useAxisJog.ts`
- Modify: `panels/ManualMotionPanel.vue` — thin script to just import + props/emits + template binding

- [ ] **Step 1: Write `composables/useAxisJog.ts`**

Extract the relative/absolute/zero motion logic from ManualMotionPanel (lines 22-155), replacing the inline implementations with a reusable composable that takes axisCount/axisLabels as reactive refs:

```typescript
// composables/useAxisJog.ts
import { ref, watch, type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  zeroMotionAxis
} from '../api'

const U_AXIS_NO = 3
const R_AXIS_NO = 4
const MAX_DECIMALS = 4

function roundMax(n: number, decimals = MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

export function useAxisJog(axisCount: Ref<number>) {
  const controllerStore = useControllerSettingsStore()
  const { success, error } = useNotification()

  const axisIndices = ref<number[]>([])
  const axisRelativeInputs = ref<number[]>([])
  const axisAbsoluteInputs = ref<number[]>([])
  const axisMotionPending = ref<Record<number, boolean>>({})
  const zeroingAxis = ref<Record<number, boolean>>({})

  watch(() => axisCount.value, (count) => {
    const indices = Array.from({ length: count }, (_, i) => i)
    axisIndices.value = indices
    const prevRel = axisRelativeInputs.value
    const prevAbs = axisAbsoluteInputs.value
    axisRelativeInputs.value = indices.map((axisNo) => {
      const v = Number(prevRel[axisNo])
      return Number.isFinite(v) ? v : 1
    })
    axisAbsoluteInputs.value = indices.map((axisNo) => {
      const v = Number(prevAbs[axisNo])
      return Number.isFinite(v) ? v : 0
    })
  }, { immediate: true })

  function normalizeManualInput(type: 'rel' | 'abs', axisNo: number): void {
    const target = type === 'rel' ? axisRelativeInputs.value : axisAbsoluteInputs.value
    const v = Number(target[axisNo])
    if (!Number.isFinite(v)) return
    target[axisNo] = roundMax(v)
  }

  function isBusy(axisNo: number): boolean { return Boolean(axisMotionPending.value[axisNo]) }
  function setBusy(axisNo: number, busy: boolean): void {
    axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: busy }
  }

  function isU(axisNo: number): boolean { return axisCount.value === 5 && axisNo === U_AXIS_NO }
  function isR(axisNo: number): boolean { return axisCount.value === 5 && axisNo === R_AXIS_NO }

  function relPlaceholder(axisNo: number): string {
    if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
    if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
    return '相对位移(mm)'
  }
  function relLabel(axisNo: number): string {
    if (isU(axisNo)) return 'U轴旋转'
    if (isR(axisNo)) return 'R轴旋转'
    return '相对运动'
  }
  function absPlaceholder(axisNo: number): string {
    if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
    if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
    return '绝对位置(mm)'
  }
  function absLabel(axisNo: number): string {
    if (isU(axisNo)) return 'U轴旋转'
    if (isR(axisNo)) return 'R轴旋转'
    return '绝对运动'
  }
  function axisSpeed(axisNo: number): number {
    const v = Number(controllerStore.controllerSettings.axes[axisNo]?.speed)
    return Number.isFinite(v) && v > 0 ? v : 20
  }

  async function handleRelativeMove(axisNo: number): Promise<void> {
    const value = Number(axisRelativeInputs.value[axisNo])
    if (!Number.isFinite(value) || value === 0) { error('输入无效', '请输入非 0 的数值'); return }
    setBusy(axisNo, true)
    try {
      const dir = value >= 0 ? '顺时针' : '逆时针'
      const absV = Math.abs(value)
      if (isU(axisNo)) {
        const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
        if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
        success('U轴旋转已下发', `角度: ${absV}°`)
        return
      }
      if (isR(axisNo)) {
        const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
        if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
        success('R轴旋转已下发', `圈数: ${absV} 圈`)
        return
      }
      const res = await moveMotionAxisRel(axisNo, value, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 相对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 相对运动已下发`, `位移: ${roundMax(value)} mm`)
    } finally { setBusy(axisNo, false) }
  }

  async function handleAbsoluteMove(axisNo: number): Promise<void> {
    const inputValue = Number(axisAbsoluteInputs.value[axisNo])
    if (!Number.isFinite(inputValue)) { error('输入无效', '请输入有效数值'); return }
    setBusy(axisNo, true)
    try {
      const dir = inputValue >= 0 ? '顺时针' : '逆时针'
      const absV = Math.abs(inputValue)
      if (isU(axisNo)) {
        const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
        if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
        success('U轴旋转已下发', `角度: ${absV}°`)
        return
      }
      if (isR(axisNo)) {
        const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
        if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
        success('R轴旋转已下发', `圈数: ${absV} 圈`)
        return
      }
      const res = await moveMotionAxisAbs(axisNo, inputValue, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 绝对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 绝对运动已下发`, `目标: ${roundMax(inputValue)} mm`)
    } finally { setBusy(axisNo, false) }
  }

  async function handleZeroAxis(axisNo: number): Promise<void> {
    if (zeroingAxis.value[axisNo]) return
    zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: true }
    try {
      const res = await zeroMotionAxis(axisNo)
      if (res?.success) { success(`轴 ${axisNo} 归零`, '归零指令已下发') }
      else { error('归零失败', res?.message ?? '') }
    } catch (e: any) { error('归零异常', e?.message ?? '') }
    finally { zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: false } }
  }

  return {
    axisIndices, axisRelativeInputs, axisAbsoluteInputs, axisMotionPending, zeroingAxis,
    normalizeManualInput, isBusy,
    relPlaceholder, relLabel, absPlaceholder, absLabel,
    handleRelativeMove, handleAbsoluteMove, handleZeroAxis
  }
}
```

- [ ] **Step 2: Update `ManualMotionPanel.vue`** — replace script with thin layer

The script becomes minimal — just props + emit + `useAxisJog(toRef(props, 'axisCount'))` + template binding.

- [ ] **Step 3: Optionally update `useMotionKeyboard.ts`** to also use `useAxisJog` for its axis movement calls (reuse the same movement methods instead of calling API directly). Skip this if it introduces complexity — the keyboard handler has unique modifier-key routing that makes direct API calls more readable.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables\useAxisJog.ts
git add -u
git commit -m "refactor: extract useAxisJog composable from ManualMotionPanel"
```

---

### Task 9: Extract useIoOutputs composable from ControllerSettingsPage

**Files:**
- Create: `composables/useIoOutputs.ts`
- Modify: `panels/ControllerSettingsPage.vue` — replace inline IO logic with composable call

- [ ] **Step 1: Write `composables/useIoOutputs.ts`**

```typescript
// composables/useIoOutputs.ts
import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useHardwareState } from '@/shared/api/hardware'
import { setMotionIoOutput } from '../api/io'
import { IO_MAP_GROUP_COUNT } from '@/shared/constants/constants'

export function useIoOutputs() {
  const { success, error, info } = useNotification()
  const { ioIn: wsIoIn, ioOut: wsIoOut } = useHardwareState()

  const ioOutputs = computed(() => {
    const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
    for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
      arr[i] = Boolean(wsIoOut.value[String(i)])
    }
    return arr
  })

  const ioInputs = computed(() => {
    const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
    for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
      arr[i] = Boolean(wsIoIn.value[String(i)])
    }
    return arr
  })

  const togglingIo = ref<Record<number, boolean>>({})

  async function handleIoOutputToggle(ioNo: number): Promise<void> {
    if (togglingIo.value[ioNo]) return
    togglingIo.value = { ...togglingIo.value, [ioNo]: true }
    const nextValue = !ioOutputs.value[ioNo]
    try {
      const res = await setMotionIoOutput(ioNo, nextValue)
      if (res?.success) {
        info(`IO 输出 ${ioNo}`, nextValue ? '已开启' : '已关闭')
      } else {
        error(`IO 输出 ${ioNo} 失败`, res?.message ?? '')
      }
    } catch (e: any) { error(`IO 输出 ${ioNo} 异常`, e?.message ?? '') }
    finally { togglingIo.value = { ...togglingIo.value, [ioNo]: false } }
  }

  return { ioOutputs, ioInputs, togglingIo, handleIoOutputToggle }
}
```

- [ ] **Step 2: Update `ControllerSettingsPage.vue`** — replace the inline IO section (lines 199-231) with `const { ioOutputs, ioInputs, togglingIo, handleIoOutputToggle } = useIoOutputs()`

Remove:
- `import { useHardwareState }` (now in composable)
- `import { setMotionIoOutput } from '@/modules/motion/ioApi'` → now in composable
- The `const { ioIn: wsIoIn, ioOut: wsIoOut } = useHardwareState()` line
- `ioOutputs`/`ioInputs` computed blocks
- `togglingIo` ref
- `handleIoOutputToggle` function

- [ ] **Step 3: Do the same for `OutputComponent.vue`** — replace its simpler IO toggles (handleOutput0/1/2) with `useIoOutputs`

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables\useIoOutputs.ts
git add -u
git commit -m "refactor: extract useIoOutputs composable from ControllerSettingsPage and OutputComponent"
```

---

### Task 10: Extract useHome composable from OutputComponent

**Files:**
- Create: `composables/useHome.ts`
- Modify: `panels/OutputComponent.vue` — replace inline homing logic with composable call

- [ ] **Step 1: Write `composables/useHome.ts`**

Extract homing workflow (lines 38-200 of OutputComponent.vue):

```typescript
// composables/useHome.ts
import { ref, computed, watch, onMounted } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import { waitControllerConnected } from '@/shared/api/hardware'
import { zeroMotionAxis, moveMotionAxisRel, getMotionIoInput } from '../api'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useHome() {
  const { success, error } = useNotification()
  const controllerStore = useControllerSettingsStore()
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  const isMovingHome = ref(false)
  const isSetHome = ref<string>('未回零')
  const ISARRIVEDHOME = ref(false)
  const autoHomeOnStart = ref(false)

  const homeState = controllerStore.loadHomeState()
  // ... (remaining homing logic: persistHomeStateToLocal, getAxisLimitInputNo,
  //      waitAxisUpperLimitInputFalse, handleHome, onMounted auto-home)

  return {
    isMovingHome, isSetHome, ISARRIVEDHOME, autoHomeOnStart,
    homeStatusClass, handleHome
  }
}
```

- [ ] **Step 2: Update `OutputComponent.vue`** — replace homing section with composable

- [ ] **Step 3: Run typecheck and commit**

```bash
npm run typecheck
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables\useHome.ts
git add -u
git commit -m "refactor: extract useHome composable from OutputComponent"
```

---

### Task 11: Write composables/index.ts barrel

- [ ] **Step 1: Write `composables/index.ts`**

```typescript
export { useMotionExecute } from './useMotionExecute'
export { useMotionKeyboard } from './useMotionKeyboard'
export { useProgramRunner } from './useProgramRunner'
export { useProgramControl } from './useProgramControl'
export { useProgramStatus } from './useProgramStatus'
export { useAxisJog } from './useAxisJog'
export { useIoOutputs } from './useIoOutputs'
export { useHome } from './useHome'
```

- [ ] **Step 2: Move `useMotionKeyboard.ts` and `useProgramRunner.ts`** into composables/ directory, update their internal imports

- [ ] **Step 3: Commit**

```bash
git add D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\composables
git add -u
git commit -m "chore: move remaining composables into composables/, add barrel"
```

---

### Task 12: Move components/pages/panels to final locations

**Files:**
- Move: `panels/ControlPanelBase.vue` → `components/ControlPanelBase.vue`
- Move: `HomePage.vue` → `pages/HomePage.vue`
- Move: `panels/ControllerSettingsPage.vue` → `pages/ControllerSettingsPage.vue`
- Update: router.ts, HomePage.vue, laser/camera imports

- [ ] **Step 1: Move ControlPanelBase.vue → components/**

```bash
mv D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\panels\ControlPanelBase.vue \
   D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\components\ControlPanelBase.vue
```

Update imports:
- `AuxiliaryPanel.vue`: `from './ControlPanelBase.vue'` → `from '../components/ControlPanelBase.vue'`
- `DriverControlPanel.vue`: `from './ControlPanelBase.vue'` → `from '../components/ControlPanelBase.vue'`
- `laser/LaserControlPanel.vue`: `from '@/modules/motion/panels/ControlPanelBase.vue'` → `from '@/modules/motion/components/ControlPanelBase.vue'`
- `camera/CameraControlPanel.vue`: same pattern

- [ ] **Step 2: Move HomePage.vue → pages/**

```bash
mv D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\HomePage.vue \
   D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\pages\HomePage.vue
```

Update internal imports in HomePage.vue:
- `from './HomeUserBar.vue'` → `from '../panels/HomeUserBar.vue'`
- `from './panels/...'` → `from '../panels/...'`
- `from './useMotionKeyboard'` → `from '../composables/useMotionKeyboard'`
- `from './useProgramRunner'` → `from '../composables/useProgramRunner'`

Update router.ts: `from '@/modules/motion/panels/ControllerSettingsPage.vue'` → `from '@/modules/motion/pages/ControllerSettingsPage.vue'`
Update App.vue if it imports HomePage directly.

- [ ] **Step 3: Move ControllerSettingsPage.vue → pages/**

```bash
mv D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\panels\ControllerSettingsPage.vue \
   D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\pages\ControllerSettingsPage.vue
```

Update internal imports in ControllerSettingsPage.vue:
- `from '../controllerConfig'` → `from '../config/controller'`
- `from '../motionTypes'` → `from '../types/controller'`
- `from '@/modules/motion/panels/ManualMotionPanel.vue'` → `from '../panels/ManualMotionPanel.vue'`

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move components/pages/panels to final locations"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full typecheck**

```bash
cd D:\Qomo\QomoTech\QomoTech_FrontEnd
npm run typecheck
```

Expected: PASS (no type errors).

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: SUCCESS.

- [ ] **Step 3: Verify no old-path imports remain**

```bash
grep -r "from.*motion/indexApi" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/useMotionStore" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/auxiliaryStore" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/motionTypes" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/controllerConfig" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/controllerValidation" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/ioApi" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/connectApi" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
grep -r "from.*motion/auxiliaryTypes" D:\Qomo\QomoTech\QomoTech_FrontEnd\src --include="*.ts" --include="*.vue" || echo "None found (good)"
```

Expected: All show "None found (good)".

- [ ] **Step 4: Verify no .ts file exports both type and function** (except types/ and index.ts)

```bash
grep -l "export type\|export interface" D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\api\*.ts
```

Expected: Empty (no files match).

Run: `grep -l "export const\|export function" D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\modules\motion\types\*.ts`

Expected: Empty (type files export only types).

- [ ] **Step 5: Commit final verification state**

```bash
git add -A
git commit -m "chore: final import path cleanup and verification"
```

---

## Self-Review Checklist (run after writing the plan)

1. **Spec coverage:** Each requirement mapped:
   - Type/implementation separation → Tasks 2-3
   - Vue logic extraction to composables → Tasks 6-10
   - Composable naming by capability → Tasks 6-10 (useAxisJog, useIoOutputs, useHome)
   - useProgramRunner split → Task 7
   - pages/panels/components classification → Task 12
   - External import update → Task 5
   - Barrel indices → Tasks 2, 3, 4, 11
   - motionApi.ts 4-way split → Tasks 2 (types), 3 (api), 11 (composable)

2. **Placeholder scan:** No TBD/TODO found.

3. **Type consistency:** `ControllerParameters` now live in `types/controller.ts`. `useControllerSettingsStore` matches the Pinia defineStore key. All composable return signatures match what the .vue files destructure.

4. **Not covered (deferred):**
   - `useAxisCenterCalib` from AuxiliaryPanel (290 lines, panel-specific, no reuse)
   - `useQuickFocus` from AuxiliaryPanel (85 lines, panel-specific, no reuse)
   - `useControllerForm` from ControllerSettingsPage (large, touches form management + save/reset/connect + axis count + field addressing — rich but low reuse)
   - These can be extracted in follow-up PRs when reuse patterns emerge.

5. **Risk items:**
   - `useMotionKeyboard.ts` directly calls API functions (moveMotionAxisRel, etc.) — this is acceptable because keyboard handler routing is unique. It shares a pattern with `useAxisJog` but the integration would be complex.
   - `HomePage.vue` `onRefreshClick` calls `syncRs232Workbench` (laser module) — we keep this in page-level script since it's page orchestration, not motion logic.
