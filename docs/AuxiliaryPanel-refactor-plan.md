# AuxiliaryPanel 拆分重构计划

> 日期：2026-05-15  
> 目标：将 `AuxiliaryPanel.vue`（464行）和 `AuxiliaryPanel.logic.ts`（671行）按 Tab 拆分为独立组件和 composable，提取通用 UI 元素到 `shared/components`。

---

## 一、现状

| 文件 | 行数 | 问题 |
|------|------|------|
| `panels/AuxiliaryPanel.vue` | 464 | 6 个 Tab 全部内联在 template 中 |
| `panels/AuxiliaryPanel.logic.ts` | 671 | 5 个功能模块的所有状态、computed、方法混在一起 |

**Template 中的 6 个 Tab：**

| Tab ID | 标签 | 行号范围 | 复杂度 |
|--------|------|----------|--------|
| `axisCenterCalib` | 五轴校准 | 78–352 (275行) | 高：步骤条、参数表单、采样列表、偏差统计、日志 |
| `quickFocus` | 快速找焦 | 353–408 (56行) | 中：点阵可视化、参数表单 |
| `quickDot` | 快速打点 | 409–417 (9行) | 低：仅一个按钮 |
| `quickConcentric` | 快速调同 | 418–427 (10行) | 低：仅一个按钮 |
| `userCustom` | 自定功能 | 428–436 (9行) | 低：占位按钮 |
| `quickMoveToPosition` | 确点移动 | 437–460 (24行) | 低：按钮 + XYZ 显示 |

**Logic 中的功能模块：**

| 模块 | 行号范围 | 行数 |
|------|----------|------|
| 面板通用状态 (tabs/activeTab) | 17–44 | 28 |
| 五轴校准 (字段+辅助函数) | 46–336 | 291 |
| 快速找焦 | 338–420 | 83 |
| 快速调同 | 422–449 | 28 |
| 五轴校准执行 (handleAxisCenterCalib) | 450–582 | 133 |
| 确点移动 | 585–608 | 24 |
| return 导出 | 611–670 | 60 |

---

## 二、目标结构

```
motion/
├── components/
│   ├── ControlPanelBase.vue          # (已有)
│   ├── AxisCenterCalibPanel.vue      # ← 新增
│   ├── QuickFocusPanel.vue           # ← 新增
│   ├── QuickDotPanel.vue             # ← 新增
│   ├── QuickConcentricPanel.vue      # ← 新增
│   ├── UserCustomPanel.vue           # ← 新增
│   └── QuickMoveToPositionPanel.vue  # ← 新增
├── composables/
│   ├── index.ts                      # (更新导出)
│   ├── useAxisCenterCalib.ts         # ← 新增
│   ├── useQuickFocus.ts              # ← 新增
│   ├── useQuickConcentric.ts         # ← 新增
│   └── useQuickMoveToPosition.ts     # ← 新增
└── panels/
    ├── AuxiliaryPanel.vue            # ← 重构：仅骨架
    └── AuxiliaryPanel.logic.ts       # ← 重构：聚合层

shared/
└── components/
    ├── StatusCard.vue                # ← 新增：label/value 信息卡片
    ├── FormField.vue                 # ← 新增：带标签的表单字段
    ├── TabBar.vue                    # ← 新增：功能入口 Tab 切换栏
    ├── PrimaryButton.vue             # ← 新增：主操作按钮
    └── SafetyConfirm.vue             # ← 新增：安全确认复选框
```

---

## 三、shared/components 通用组件（5个）

### 3.1 `StatusCard.vue` — 标签/数值信息卡片

**重复次数**：25+ 次

**原始模式**：
```html
<div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
  <p class="text-xs text-(--app-text-muted)">标签</p>
  <p class="mt-1 text-sm text-(--app-text-primary)">值</p>
</div>
```

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `string` | — | 标签文字 |
| `value` | `string` | — | 显示值 |
| `variant` | `'default' \| 'card'` | `'default'` | `default` → `bg-(--app-input-bg)`；`card` → `bg-(--app-card)` |

**替换范围**：AuxiliaryPanel.vue 行 182–197, 218–225, 251–258, 284–315, 320–343, 447–458。

---

### 3.2 `FormField.vue` — 带标签的表单控件

**重复次数**：12+ 次

**原始模式**：
```html
<label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
  标签名
  <input v-model.number="val" type="number" step="any" :disabled="locked"
    class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50" />
</label>
```

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `string` | — | 标签文字 |
| `modelValue` | `number \| string` | — | 支持 `v-model` |
| `type` | `'number' \| 'text' \| 'select'` | `'number'` | 控件类型 |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `min` | `number` | — | 最小值（type=number） |
| `step` | `number \| string` | `'any'` | 步长 |
| `options` | `{ value: number; label: string }[]` | — | type=select 时的选项 |

**替换范围**：行 100–141, 262–280, 374–406。

---

### 3.3 `TabBar.vue` — Tab 切换栏

**重复次数**：1 次（但通用性强）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tabs` | `{ id: string; label: string }[]` | — | Tab 列表 |
| `modelValue` | `string` | — | 当前选中 Tab ID，支持 `v-model` |
| `disabled` | `boolean` | `false` | 全局禁用 |

**原始位置**：行 55–75。

---

### 3.4 `PrimaryButton.vue` — 主操作按钮

**重复次数**：6 次

**原始模式**：
```html
<button type="button" :disabled="busy" @click="handler"
  class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50">
  {{ text }}
</button>
```

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `disabled` | `boolean` | `false` | 禁用状态 |
| `loading` | `boolean` | `false` | 加载状态（覆盖 disabled） |

**Slot**：默认 slot 用于按钮文字。

**Emits**：`click`。

---

### 3.5 `SafetyConfirm.vue` — 安全确认复选框

**重复次数**：1 次（但语义独立，值得提取）

**原始模式**：
```html
<div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
  <label class="flex items-start gap-2 text-sm text-(--app-text-primary)">
    <input v-model="confirmed" type="checkbox" :disabled="locked" class="mt-1" />
    <span>已确认…</span>
  </label>
</div>
```

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `boolean` | — | 支持 `v-model` |
| `disabled` | `boolean` | `false` | — |
| `message` | `string` | — | 安全提示文字 |

---

## 四、motion/components Tab 组件（6个）

### 4.1 `AxisCenterCalibPanel.vue` — 五轴校准

**来源**：AuxiliaryPanel.vue 行 78–352（~275行）

**内容清单**：
- 功能说明文字（3 行）
- 步骤进度条 → `axisCenterCalibStepItems`（4 列网格）
- 参数输入区（4 列 → 2 列网格）：
  - 旋转轴 select（U/R）
  - 起始角 input
  - 角度步长 input
  - 采样点数 input
  - 等待时间 input
  - 激光时间 input
- Checkbox 区（2 列网格）：
  - 自动打点
  - 结束后回起始角
- 安全确认 → 使用 `<SafetyConfirm>`
- 状态信息（4 列）：当前阶段、目标旋转轴、当前角度、失败信息
- 操作按钮：开始校准（PrimaryButton）+ 重置
- 实时轴位置（5 列网格）
- 采样点列表 `v-for`（含 XY 偏差输入 + 轴位置卡片）
- XY 补偿值显示（3 列）
- 偏差统计（4 列：均值 X、均值 Y、峰峰值 X、峰峰值 Y）
- 执行日志（可滚动）

**使用组件**：`StatusCard`, `FormField`, `PrimaryButton`, `SafetyConfirm`

**Composable**：`useAxisCenterCalib()`（内部调用）

---

### 4.2 `QuickFocusPanel.vue` — 快速找焦

**来源**：AuxiliaryPanel.vue 行 353–408（~56行）

**内容清单**：
- 执行按钮 → `PrimaryButton`
- 点阵可视化（`quickFocusDotGridStyle` + 圆点网格）
- 参数输入（3 列）：
  - X/Y 数量
  - step
  - Z_step

**使用组件**：`PrimaryButton`, `FormField`

**Composable**：`useQuickFocus()`（内部调用）

---

### 4.3 `QuickDotPanel.vue` — 快速打点

**来源**：行 409–417（~9行）

**内容**：一个 `PrimaryButton`，disabled 条件 `isQuickFocusing`

**Composable**：无独立逻辑（按钮事件待实现）

---

### 4.4 `QuickConcentricPanel.vue` — 快速调同

**来源**：行 418–427（~10行）

**内容**：一个 `PrimaryButton`，点击触发 `handleQuickConcentric`

**使用组件**：`PrimaryButton`

**Composable**：`useQuickConcentric()`（内部调用）

---

### 4.5 `UserCustomPanel.vue` — 自定功能

**来源**：行 428–436（~9行）

**内容**：一个 `PrimaryButton`（占位）

**Composable**：无

---

### 4.6 `QuickMoveToPositionPanel.vue` — 确点移动

**来源**：行 437–460（~24行）

**内容清单**：
- 保存按钮 → `PrimaryButton`
- XYZ 当前位置 → 3 个 `StatusCard`

**使用组件**：`PrimaryButton`, `StatusCard`

**Composable**：`useQuickMoveToPosition()`（内部调用）

---

## 五、motion/composables 逻辑拆分（4个）

### 5.1 `useAxisCenterCalib.ts` — 五轴校准逻辑

**来源**：`AuxiliaryPanel.logic.ts` 行 46–582（~490行）

**导出清单**：

**类型**（内部使用）：
- `AxisCenterCalibPhase`
- `AxisCenterCalibSampleState`
- `AxisCenterCalibSample`

**Refs**：
- `isAxisCenterCalib`
- `axisCenterCalibPhase`
- `axisCenterCalibErrorMessage`
- `axisCenterCalibRotationAxisNo`
- `axisCenterCalibStartAngle`
- `axisCenterCalibAngleStep`
- `axisCenterCalibSampleCount`
- `axisCenterCalibSettleMs`
- `axisCenterCalibLaserPulseMs`
- `axisCenterCalibAutoPulse`
- `axisCenterCalibReturnToStart`
- `axisCenterCalibSafetyConfirmed`
- `axisCenterCalibSamples`
- `axisCenterCalibLogs`
- `axisCenterCalibPendingRecordSampleId`

**Computed**：
- `axisCenterCalibRotationAxisLabel`
- `axisCenterCalibPhaseLabel`
- `axisCenterCalibStepItems`
- `axisCenterCalibActiveStepIndex`
- `axisCenterCalibLivePositions`
- `axisCenterCalibCurrentAngleText`
- `axisCenterCalibManualSummary`

**常量**：
- `axisNameByNo`
- `axisCenterCalibDisplayAxes`
- `axisCenterCalibCenterBasedXYSum`（来自 store）

**函数**：
- `normalizeAxisCenterCalibSampleCount`
- `getAxisCenterCalibStepState`
- `getAxisCenterCalibSampleClass`
- `getAxisPosition`
- `captureAxisSnapshot`
- `displaySampleAxisPosition`
- `hasSampleMachinePositions`
- `handleManualRecordAxisCenterCalibSample`
- `rebuildAxisCenterCalibSamples`
- `logAxisCenterCalib`
- `resetAxisCenterCalibWorkflow`
- `handleAxisCenterCalib`

**内部函数**（不导出）：
- `waitForAxisCenterCalibManualRecord`
- `clearAxisCenterCalibManualRecordWait`
- `pulseCalibrationLaser`
- `moveAxisToAngle`

**依赖**：
- `useControllerSettingsStore`
- `useAuxiliaryFunctionPanelStore`
- `useHardwareState`
- `useNotification`
- `motion/api` (`moveMotionAxisAbs`, `moveMotionAxisRel`, `rotateRAxisByTurns`, `rotateUAxisByAngle`, `setMotionIoOutput`)
- `motion/utils` (`sleep`)
- `motion/types` (`MotionAxis`)

---

### 5.2 `useQuickFocus.ts` — 快速找焦逻辑

**来源**：行 338–420（~83行）

**导出清单**：

**Refs**：
- `isQuickFocusing`
- `quickFocusGridSize`
- `quickFocusStep`
- `quickFocusZStep`
- `quickFocusPoints`

**Computed**：
- `quickFocusDotGridStyle`

**函数**：
- `getQuickFocusPointClass`
- `rebuildQuickFocusPoints`
- `handleQuickFocus`

**依赖**：
- `useHardwareState`
- `useNotification`
- `setMotionIoOutput`, `moveMotionAxisRel`
- `sleep`

---

### 5.3 `useQuickConcentric.ts` — 快速调同逻辑

**来源**：行 422–449（~28行）

**导出清单**：

**Refs**：
- `isQuickConcentric`

**函数**：
- `handleQuickConcentric`

**依赖**：
- `useNotification`
- `setMotionIoOutput`, `moveMotionAxisRel`
- `sleep`

---

### 5.4 `useQuickMoveToPosition.ts` — 确点移动逻辑

**来源**：行 585–608（~24行）

**导出清单**：

**函数**：
- `displayQuickMoveAxis`
- `handleSaveQuickMoveToPosition`

**依赖**：
- `useAuxiliaryFunctionPanelStore`
- `useHardwareState`
- `getAxisPosition`（从 `useAxisCenterCalib` 借用，或提为共享）
- `useNotification`

> ⚠️ `displayQuickMoveAxis` 依赖 `auxiliaryFunctionPanelStore.AuxiliaryFunctionPanel_quickMoveToPosition`，该 store 已在 `useAuxiliaryFunctionPanelStore` 中。

---

## 六、重构后的 AuxiliaryPanel

### 6.1 `AuxiliaryPanel.logic.ts`（聚合层，~30行）

```ts
import { ref } from 'vue'
import { useAxisCenterCalib } from '../composables/useAxisCenterCalib'
import { useQuickFocus } from '../composables/useQuickFocus'
import { useQuickConcentric } from '../composables/useQuickConcentric'
import { useQuickMoveToPosition } from '../composables/useQuickMoveToPosition'

export function useAuxiliaryPanelLogic() {
  const isPanelExpanded = ref(false)
  const activeTab = ref<string>('axisCenterCalib')
  const tabs = [
    { id: 'axisCenterCalib', label: '五轴校准' },
    { id: 'quickMoveToPosition', label: '确点移动' },
    { id: 'quickDot', label: '快速打点' },
    { id: 'quickFocus', label: '快速找焦' },
    { id: 'quickConcentric', label: '快速调同' },
    { id: 'userCustom', label: '自定功能' },
  ]

  const axisCalib = useAxisCenterCalib()
  const quickFocus = useQuickFocus()
  const quickConcentric = useQuickConcentric()
  const quickMove = useQuickMoveToPosition()

  return {
    isPanelExpanded,
    activeTab,
    tabs,
    ...axisCalib,
    ...quickFocus,
    ...quickConcentric,
    ...quickMove,
  }
}
```

### 6.2 `AuxiliaryPanel.vue`（骨架，~35行）

```vue
<script setup lang="ts">
import ControlPanelBase from '../components/ControlPanelBase.vue'
import TabBar from '@/shared/components/TabBar.vue'
import AxisCenterCalibPanel from '../components/AxisCenterCalibPanel.vue'
import QuickFocusPanel from '../components/QuickFocusPanel.vue'
import QuickDotPanel from '../components/QuickDotPanel.vue'
import QuickConcentricPanel from '../components/QuickConcentricPanel.vue'
import UserCustomPanel from '../components/UserCustomPanel.vue'
import QuickMoveToPositionPanel from '../components/QuickMoveToPositionPanel.vue'
import { useAuxiliaryPanelLogic } from './AuxiliaryPanel.logic'

const { isPanelExpanded, activeTab, tabs } = useAuxiliaryPanelLogic()
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isPanelExpanded"
    title="辅助功能区"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5">
      <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
      <TabBar v-model="activeTab" :tabs="tabs" />
    </div>

    <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5">
      <AxisCenterCalibPanel v-if="activeTab === 'axisCenterCalib'" />
      <QuickFocusPanel v-if="activeTab === 'quickFocus'" />
      <QuickDotPanel v-if="activeTab === 'quickDot'" />
      <QuickConcentricPanel v-if="activeTab === 'quickConcentric'" />
      <UserCustomPanel v-if="activeTab === 'userCustom'" />
      <QuickMoveToPositionPanel v-if="activeTab === 'quickMoveToPosition'" />
    </div>
  </ControlPanelBase>
</template>
```

---

## 七、实施顺序

| 步骤 | 操作 | 文件 | 依赖 |
|------|------|------|------|
| 1 | 创建通用组件 | `shared/components/StatusCard.vue` | 无 |
| 2 | 创建通用组件 | `shared/components/FormField.vue` | 无 |
| 3 | 创建通用组件 | `shared/components/PrimaryButton.vue` | 无 |
| 4 | 创建通用组件 | `shared/components/SafetyConfirm.vue` | 无 |
| 5 | 创建通用组件 | `shared/components/TabBar.vue` | 无 |
| 6 | 提取逻辑 | `motion/composables/useAxisCenterCalib.ts` | Step 1–4 的组件类型定义 |
| 7 | 提取逻辑 | `motion/composables/useQuickFocus.ts` | — |
| 8 | 提取逻辑 | `motion/composables/useQuickConcentric.ts` | — |
| 9 | 提取逻辑 | `motion/composables/useQuickMoveToPosition.ts` | — |
| 10 | 创建 Tab 组件 | `motion/components/AxisCenterCalibPanel.vue` | Step 1–6 |
| 11 | 创建 Tab 组件 | `motion/components/QuickFocusPanel.vue` | Step 1–3, 7 |
| 12 | 创建 Tab 组件 | `motion/components/QuickDotPanel.vue` | Step 3 |
| 13 | 创建 Tab 组件 | `motion/components/QuickConcentricPanel.vue` | Step 3, 8 |
| 14 | 创建 Tab 组件 | `motion/components/UserCustomPanel.vue` | Step 3 |
| 15 | 创建 Tab 组件 | `motion/components/QuickMoveToPositionPanel.vue` | Step 1, 3, 9 |
| 16 | 重构聚合层 | `motion/panels/AuxiliaryPanel.logic.ts` | Step 6–9 |
| 17 | 重构骨架 | `motion/panels/AuxiliaryPanel.vue` | Step 5, 10–16 |
| 18 | 更新索引 | `motion/composables/index.ts` | Step 6–9 |

---

## 八、风险与交叉依赖

| 风险项 | 说明 | 处理方案 |
|--------|------|----------|
| **`getAxisPosition` 跨模块引用** | `useQuickMoveToPosition` 需要获取轴位置，目前 `getAxisPosition` 在五轴校准模块中定义 | 将 `getAxisPosition` 提取为独立工具函数，或让 composable 内部自行实现 |
| **`isQuickFocusing` 交叉禁用** | `QuickDotPanel`、`QuickConcentricPanel`、`UserCustomPanel`、`QuickMoveToPositionPanel` 的按钮均使用 `isQuickFocusing` 做禁用条件 | 保持 `isQuickFocusing` 在聚合层返回，通过 props 传入各 tab 组件 |
| **`axisCenterCalibDisplayAxes` template 直接引用** | 原 template `v-for="axisName in axisCenterCalibDisplayAxes"` 直接从 logic 获取 | 拆分后在 `AxisCenterCalibPanel` 内部通过 composable 获取，不受影响 |
| **`axisCenterCalibCenterBasedXYSum` store 引用** | 来自 `useAuxiliaryFunctionPanelStore`，在 handleAxisCenterCalib 中写入，在 template 中读取 | 在 `useAxisCenterCalib` 中持有引用并导出 |
| **`QuickDot` 和 `UserCustom` 目前是空壳** | 按钮无实际事件处理 | 保持最小实现，预留扩展点 |

---

## 九、验证清单

- [ ] 所有 TypeScript 类型检查通过（`npx vue-tsc --noEmit`）
- [ ] `AuxiliaryPanel.vue` 渲染结果与拆分前一致
- [ ] 五轴校准完整流程可正常执行（参数配置 → 采样 → 偏差录入 → 统计）
- [ ] 快速找焦矩阵打点可视化正常
- [ ] 快速调同按钮功能正常
- [ ] 确点移动保存/显示正常
- [ ] Tab 切换无状态残留（切换 tab 再切回时数据不丢失）
- [ ] `StatusCard`、`FormField` 等通用组件在项目中其他位置可正常复用
