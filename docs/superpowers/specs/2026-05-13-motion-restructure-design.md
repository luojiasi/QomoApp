# motion 模块按类型重组 — 设计文档

- 日期：2026-05-13
- 范围：`QomoTech_FrontEnd/src/renderer/src/modules/motion/`
- 形式：**纯结构重组 + 从 .vue 中抽取业务逻辑**，不修改业务语义

## 1. 目标

1. 将 `motion/` 内部按"文件类型/职责"分层：API 调用、TS 类型、Pinia Store、Composable、配置、校验、组件、页面、面板各归其位。
2. 严格分离 **TS interface/type** 与 **函数实现** —— 现有 Api 文件里夹带的 interface 全部迁到 `types/`，Api 文件只剩纯函数。
3. `.vue` 文件回归"模板 + 装配"角色：把 `<script setup>` 中的业务逻辑抽到细粒度 Composable，按能力命名（`useAxisJog`、`useIoOutputs`…）而非按面板命名。
4. 一次性更新所有外部 import 路径，不留兼容 barrel。

## 2. 不在本次范围

- 不动 `camera/` `laser/` `workflow/` `editor/` 等兄弟模块的内部结构。
- 不修改业务语义。如果重构过程中发现疑似 bug 或语义可疑的写法，**先停下来询问用户**，由用户决定是否一并修改。
- 不改 UI/UX、不改 props/emits 对外契约。

## 3. 现状摘要

| 类别 | 现有文件 |
|---|---|
| API 函数（混带类型） | axisApi.ts、bootstrapApi.ts、connectApi.ts、ioApi.ts、motionApi.ts、programApi.ts、indexApi.ts |
| 纯类型 | motionTypes.ts、auxiliaryTypes.ts |
| 配置 | controllerConfig.ts、qomo5pConfig.ts |
| 校验 | controllerValidation.ts |
| Store | useMotionStore.ts、auxiliaryStore.ts |
| Composable | useMotionKeyboard.ts、useProgramRunner.ts |
| 顶级组件 | HomePage.vue、HomeUserBar.vue |
| 面板 | panels/AuxiliaryPanel.vue (1038)、ControllerSettingsPage.vue (709)、DriverControlPanel.vue、ManualMotionPanel.vue、OutputComponent.vue、StartProgramPanel.vue、TaskProgressAside.vue、ControlPanelBase.vue |

合计 26 文件，约 4766 行。被 15 个文件 import（含 8 个外部模块）。

`motionApi.ts` 同时导出 `useMotionExecute` composable —— 属混合关注点。`useProgramRunner.ts` 381 行需拆分。

## 4. 目标结构

```
modules/motion/
├── api/                              纯 HTTP/RPC 调用，无 type 导出
│   ├── axis.ts
│   ├── bootstrap.ts
│   ├── connect.ts
│   ├── io.ts
│   ├── motion.ts
│   ├── program.ts
│   └── index.ts                      api barrel
├── types/                            interface / type 唯一来源
│   ├── axis.ts                       MotionAxis、UAxisRotateRequestPayload、RAxisRotateRequestPayload
│   ├── bootstrap.ts                  BackendBootstrapResult
│   ├── connect.ts                    MotionAxisParamsPayload、MotionAllAxesParamsRequestPayload
│   ├── controller.ts                 原 motionTypes.ts 全部
│   ├── io.ts                         MotionIoOutputState、MotionIoInputState
│   ├── motion.ts                     CommonOnlineCommand、AXIS_STATUS_BIT_DESCRIPTIONS 中的 type 部分
│   ├── program.ts                    Product4PCenterRotationPayload、StartProgramStatusData、StartProgramControlAction
│   ├── auxiliary.ts                  XYZ
│   └── index.ts
├── stores/
│   ├── useControllerSettingsStore.ts 原 useMotionStore.ts，重命名贴合 defineStore key
│   ├── useAuxiliaryFunctionPanelStore.ts 原 auxiliaryStore.ts
│   └── index.ts
├── composables/                      细粒度能力，按能力命名
│   ├── useMotionExecute.ts           从 motionApi.ts 抽出
│   ├── useMotionKeyboard.ts          已有
│   ├── useProgramRunner.ts           保留主入口，瘦身
│   ├── useProgramControl.ts          pause/resume/skip/estop/reset 控制 + 软暂停
│   ├── useProgramStatus.ts           状态轮询、running/paused 派生
│   ├── useAxisJog.ts                 从 ManualMotionPanel/AuxiliaryPanel 抽
│   ├── useIoOutputs.ts               从 OutputComponent/AuxiliaryPanel/DriverControlPanel 抽
│   ├── useIoInputs.ts                从 AuxiliaryPanel 抽
│   ├── useDriverControl.ts           从 DriverControlPanel 抽
│   ├── useControllerForm.ts          从 ControllerSettingsPage 抽（编辑/校验/保存）
│   └── index.ts
├── config/
│   ├── controller.ts                 原 controllerConfig.ts
│   ├── qomo5p.ts                     原 qomo5pConfig.ts
│   └── index.ts
├── validation/
│   ├── controller.ts                 原 controllerValidation.ts
│   └── index.ts
├── components/                       跨模块共享或多面板共用
│   └── ControlPanelBase.vue          laser/camera 也在用
├── pages/                            路由直接挂载的顶级页面
│   ├── HomePage.vue
│   └── ControllerSettingsPage.vue
├── panels/                           主页/页面内部组合的业务面板
│   ├── AuxiliaryPanel.vue
│   ├── DriverControlPanel.vue
│   ├── HomeUserBar.vue
│   ├── ManualMotionPanel.vue
│   ├── OutputComponent.vue
│   ├── StartProgramPanel.vue
│   └── TaskProgressAside.vue
└── index.ts                          模块顶层 barrel（types + api + stores + composables）
```

## 5. 贯穿规则

1. **类型与实现分离**：`api/` `stores/` `composables/` `config/` 中**禁止** `export type`/`export interface`。所有类型只能从 `types/` 导出。
2. **.vue `<script setup>` 内容限定**：
   - 允许：import composable/store/api/types；接 props/emits/route 参数；把 composable 返回值绑到模板；纯 UI 局部状态（弹窗/tab 序号/折叠开关）。
   - 禁止：HTTP 调用、跨组件状态、轮询/setInterval、复杂派生计算、业务校验。
3. **Composable 命名**：以"能力/场景"为单位（`useAxisJog`、`useIoOutputs`），同一个 composable 被多个面板复用；不按面板命名。
4. **顶层 barrel**：`motion/index.ts` 重新导出 `api/`、`types/`、`stores/`、`composables/` 的公共符号；`config/`、`validation/` 视需要导出。
5. **外部 import 路径全部更新**到新位置；不保留旧路径的兼容层。
6. **遇到逻辑修改类问题立即停下来问用户**，不私自修改业务行为。

## 5.1 motionApi.ts 特殊拆解

该文件混合了 4 类内容，按规则要分拆：

| 现有内容 | 去向 |
|---|---|
| `CommonOnlineCommand` 类型 | `types/motion.ts` |
| `AXIS_STATUS_BIT_DESCRIPTIONS`、`commonOnlineCommandsData` 常量 | `config/motion.ts` |
| `resolveOnlineCommandResultText`、`parseAxisStatusValue`、`formatAxisStatusAnalysis` 等纯工具函数 | `api/motion.ts`（属于"调用相关的响应解析"） |
| `useMotionExecute` composable | `composables/useMotionExecute.ts` |

## 5.2 indexApi.ts 处置

原 `indexApi.ts` 是 `api/` 的 barrel，整体由新的 `api/index.ts` 承担其角色，原文件删除；如有人 `import * from '@/modules/motion/indexApi'`，统一改为 `from '@/modules/motion/api'`。

## 6. 受影响的外部消费者

需要更新 import 的 8 个外部文件：

- `app/App.vue`
- `app/router.ts`
- `modules/workflow/MotionController.vue`
- `modules/settings/useSettingsPages.ts`
- `modules/editor/useQomo5PStore.ts`
- `modules/camera/CameraControlPanel.vue`（仅 ControlPanelBase）
- `modules/laser/LaserControlPanel.vue`（仅 ControlPanelBase）

模块内部：`motion/panels/*.vue`、`HomePage.vue`、`useProgramRunner.ts`、`useMotionKeyboard.ts`、`useMotionStore.ts` 全部需要按新路径调整 import。

## 7. 实施阶段（建议拆 plan 时遵循）

**阶段 1 — 纯文件搬迁 + 类型剥离**（不动 .vue 逻辑）
  - 建立新目录与各 `index.ts` barrel
  - 从 Api 文件抽出 type 到 `types/`，Api 文件只剩函数
  - 移动 stores/config/validation
  - 改名 `useMotionStore.ts` → `useControllerSettingsStore.ts`（与 defineStore key 一致）
  - 全量更新所有 import
  - 验收：`npm run typecheck` 与 `npm run build` 通过

**阶段 2 — Composable 抽取**（按能力）
  - 拆 `useProgramRunner` 为 3 个
  - 把 `motionApi.ts` 中的 `useMotionExecute` 挪到 composables/
  - 从每个 panel 抽出 `useAxisJog`、`useIoOutputs`、`useIoInputs`、`useDriverControl`、`useControllerForm`
  - 每抽一个，对应 .vue `<script setup>` 瘦身一次，类型检查 + 人工冒烟
  - 遇到疑似逻辑问题立即停下询问用户

**阶段 3 — components/pages/panels 分类**
  - `ControlPanelBase.vue` → `components/`
  - `HomePage.vue` / `ControllerSettingsPage.vue` → `pages/`
  - 其余面板留 `panels/`
  - 更新 router、HomePage、ControllerSettingsPage 中的 import

**阶段 4 — 验收**
  - 类型检查
  - 启动 dev 服务器
  - 走通主页面 → 控制器设置 → 手动运动 → IO → 启动程序的完整链路
  - 验证 laser/camera 共享的 `ControlPanelBase` 仍正常

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 多文件批量改 import 出错 | 阶段 1 单独提交、单独验收；阶段间互不阻塞 |
| 抽 composable 时引入语义偏差 | 严守"只搬不改"，可疑处停下问用户 |
| `useProgramRunner` 拆分边界不清 | 拆前先在 plan 中列清三个 composable 各自的 ref/方法清单 |
| 跨模块共享 `ControlPanelBase` 移位 | 单独一步、单独验收；只改 import 路径不动文件内容 |
| `useMotionStore` 重命名遗漏调用点 | grep `useMotionStore` 与 `useControllerSettingsStore`，对照 defineStore key 全替换 |

## 9. 验收标准

- `motion/` 目录下没有 .ts 文件同时导出 `interface/type` 与函数（除 `types/` 与 `index.ts`）。
- 每个 `.vue` 文件 `<script setup>` 不含 `apiCall`、`fetch`、`axios`、`setInterval` 等系统级调用，也不再 `import` `api/`（统一通过 composable 接入）。
- `npm run typecheck`、`npm run build` 通过。
- 通过路由跳转主页、控制器设置页，手动测试关键路径无回归。
- 所有外部消费者按新路径 import，无 `from '@/modules/motion/<旧文件>'` 残留。
