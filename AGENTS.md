# AGENTS.md

> QomoTech 是一套用于控制工业机器人的跨平台桌面应用。
> 本文件定义 AI 辅助开发的硬性约束，确保代码修改可预测、可审查、可复现。
> **所有 AI 工具（Cursor、DeepSeek CLI、Claude Code 等）均须遵守本文件**，其优先级高于模型默认行为。

---

## 1. 仓库结构

```
QomoTech/
├── AGENTS.md                        # 本文件（项目级 AI 规范）
├── QomoTech_FrontEnd/               # Electron + Vue 3 前端
│   └── src/
│       ├── main/                    # Electron 主进程（IPC、文件系统、窗口）
│       ├── preload/                 # preload（window.api 注入）
│       └── renderer/src/
│           ├── app/                 # 路由、App.vue、页面入口
│           ├── shared/              # 跨模块共享（api、stores、组件）
│           └── modules/             # 功能模块（每个模块自治）
│               ├── auth/
│               ├── camera/
│               ├── motion/
│               ├── program/         # 配方程序运行（HTTP + WebSocket）
│               ├── recipe/
│               ├── workflow/        # 自定流程编排（严格分层，见下文）
│               └── ...
└── QomoTech_BackEnd/                # Python FastAPI 后端
    ├── routers/http/                # REST 路由
    ├── routers/websocket/           # WebSocket
    ├── services/                    # 业务逻辑
    ├── core/                        # FastAPI 应用
    └── run.py                       # 启动入口
```

**技术栈：**

| 层 | 技术 |
|----|------|
| 前端 | Electron 39、Vue 3、TypeScript 5、Vite、Tailwind CSS 4、Pinia、VueFlow |
| 后端 | Python、FastAPI，默认 `http://127.0.0.1:5000` |
| 通信 | 渲染进程 REST（`shared/api/httpClient`）+ Electron IPC（`window.api`） |

---

## 2. 工作方式

- **用中文与用户沟通**（除非用户明确要求英文）。
- **事实优先**：结论必须基于当前代码、配置或 git 状态，不臆测。
- **调试优先**：禁止无声降级、吞错、隐藏 fallback、伪成功分支来「让代码跑起来」。
- **KISS / YAGNI**：用最直接、可验证的方案；不为「架构完整性」预植空抽象。
- **最小闭环**：只改当前任务必要部分，不顺带修无关问题。
- **并行收集上下文**：无依赖的文件读取、搜索、`git status` 应并发执行。
- **复杂任务先写控制合约**，再动代码：
  - **目标**：本次确切要达成什么
  - **验收**：用什么命令/行为证明完成
  - **护栏**：哪些不能被破坏
  - **边界**：哪些文件/模块在范围内
  - **风险**：1–3 条主要风险

---

## 3. 强制规则

### 3.1 前端模块严格分层边界

每个 `modules/<name>/` 目录必须严格遵守以下职责，**违反的代码不可提交**：

| 目录 | 职责 | 禁止事项 |
|------|------|----------|
| `types/` | 仅 `type` / `interface` / `enum` | 禁止 `export const`、函数实现、Vue 依赖 |
| `constants/` | 常量、默认值、选项、约束 | 禁止类型定义、Vue 依赖 |
| `infra/` | 平台桥接（`window.api`、键盘等） | **唯一**允许 `window as unknown` 强转的层 |
| `store/` | Pinia 状态与编排 | 禁止直接访问 `window.api`，须经 `infra/` |
| `composables/` | Vue 逻辑（hooks） | 禁止声明业务 `interface`，只 `import type` from `types/` |
| `components/` | 渲染 + 事件转发 | 复杂逻辑下沉到 `composables/` |
| `utils/` | 纯函数、无副作用 | 禁止 Vue 依赖 |
| `nodes/` | 节点蓝图与执行（workflow 特有） | 同上层规则 |
| `UI/` | 模块内通用基础组件 | 不含业务逻辑 |

**依赖方向（单向，禁止反向）：**

```
components → composables → store → infra
                         ↓
               types / constants / utils / nodes
```

### 3.2 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| 子组件 | `[父组件名]_[子组件名].vue` | `SelfProcessPage_WorkflowCanvas.vue` |
| 画布子组件 | `WorkflowCanvas_*.vue` | `WorkflowCanvas_Node.vue` |
| Composable | `use[模块][功能].ts` | `useWorkflowCanvas.ts` |
| Store | `use[模块]Store.ts` | `useWorkflowStore.ts` |
| 类型文件 | 按描述对象 | `workflow.ts`、`canvasSettings.ts` |
| 常量文件 | 按描述对象 | `canvasSettingsDefaults.ts` |

### 3.3 类型与常量分离

- `types/` 中**禁止**任何 `export const`
- 默认值、选项、滑块范围等放在 `constants/`
- 其他层需要类型时只允许 `import type` from `types/`

### 3.4 `window.api` 访问隔离

- `window.api`（Electron preload）的获取与强转**只允许**在 `infra/`
- store / composables 通过 `getWorkflowApi()` 等 infra 函数间接使用

### 3.5 持久化与默认值

**流程数据（workflow.json）：**

- 路径：`{workflowsBasePath}/workflow_{id}/workflow.json`
- 索引：`{workflowsBasePath}/index.json`
- 节点参数字段名为 **`params`**（不是 `config`）
- 加载旧数据时可将 `config` 合并为 `params`（见 `useWorkflowStore`）

**画布 UI 设置（当前实现）：**

- 默认值：`constants/canvasSettingsDefaults.ts`
- 用户覆盖：`workflow.json` 的 `canvasSettings` 字段（仅保存与默认值不同的字段，由 `useCanvasSettings` 的 `override` ref 管理）
- 生效值：`mergeCanvasSettings(override)`（`utils/canvasSettingsUtils.ts`）
- UI 与逻辑只读 **effective**，不直接把默认值写入存储

### 3.6 前后端通信

| 场景 | 方式 |
|------|------|
| 通用 REST | `shared/api/httpClient` → `http://127.0.0.1:5000` |
| 程序运行 | `modules/program/api/` |
| 流程文件读写 | Electron `window.api` → `workflow/infra/workflowApiBridge.ts` |
| 节点执行（规划） | `nodes/executor/nodeExecutor.ts`（当前为占位） |

- **禁止**在 Vue 组件里直接 `fetch` 后端
- **禁止**在 `components/` 里写 HTTP 业务逻辑

### 3.7 禁止提交的内容

- 运行时流程 JSON（除非明确提供示例数据）
- `.venv/`、`dist/`、`build/`、`__pycache__/`、`*.pyc`
- 真实密钥/证书
- 未通过 `npm run typecheck` 的代码

### 3.8 变更边界

- 每次只完成当前任务的最小改动
- 发现可优化点先记录，**当前任务完成后再另开任务**
- 改动 `infra/` 或 `store/` 时，检查依赖该层的 composable 是否需同步更新

---

## 4. workflow 模块专规

### 4.1 目录职责（当前）

```
modules/workflow/
├── SelfProcessPage.vue              # 三栏：流程列表 | 画布 | 设置（节点/画布 Tab）
├── types/
│   ├── workflow.ts                # Workflow、WorkflowNode、WorkflowEdge
│   ├── workflowApi.ts               # Electron 文件 API 类型
│   ├── canvasSettings.ts            # 画布与连线 UI 设置类型
│   └── nodeDefinition.ts            # 节点蓝图类型
├── constants/
│   ├── canvasSettingsDefaults.ts
│   ├── canvasSettingsOptions.ts
│   ├── canvasSettingsConstraints.ts
│   ├── workflowCanvas.ts
│   ├── workflowEdge.ts
│   └── nodeStyles.ts
├── infra/
│   ├── workflowApiBridge.ts
│   └── canvasKeyboardBridge.ts
├── utils/
│   ├── workflowUtils.ts
│   ├── canvasSettingsUtils.ts
│   ├── nodeRegistryUtils.ts         # 节点注册表（Map）
│   ├── edgeMarkerUtils.ts
│   └── edgePathUtils.ts             # 含 resolveEdgeHandlePositions
├── store/useWorkflowStore.ts
├── composables/
│   ├── useWorkflowStore 相关：useWorkflowList.ts
│   ├── useWorkflowCanvas.ts
│   ├── useWorkflowEdge.ts
│   ├── useWorkflowNode.ts
│   └── useCanvasSettings.ts
├── components/
│   ├── SelfProcessPage_WorkflowList.vue
│   ├── SelfProcessPage_WorkflowCanvas.vue
│   ├── SelfProcessPage_NodeSettings.vue
│   ├── SelfProcessPage_CanvasSettings.vue
│   ├── WorkflowCanvas_Node.vue
│   ├── WorkflowCanvas_Menu.vue
│   └── WorkflowCanvas_Edge.vue      # 自定义边，修正水平箭头朝向
├── nodes/
│   ├── definitions/                 # trigger / motion / camera / rs232 / flow / data / test
│   └── executor/
│       ├── nodeExecutor.ts          # 主入口 + BFS 遍历（对外 API）
│       ├── triggerService.ts        # Trigger 解析（findTriggerNodes / resolveGlobalEntryTriggers）
│       ├── graphTraversal.ts        # 图谱工具（findDownstreamNodeIds / buildTriggerEntries）
│       ├── nodeRunner.ts            # 单节点分派（executeSingleNode）
│       └── localExecutors/
│           ├── index.ts             # 本地执行器注册表 + executeLocal 分派
│           └── delayExecutor.ts     # flow.delay 延时执行器
├── workflow.css                     # 模块滚动工具类（无可见滚动条）
└── UI/                              # AppButton、AppTabs、AppInput 等
```

### 4.2 滚动与滚动条（workflow 模块）

- **凡需滚动的区域**：使用 `workflow/workflow.css` 工具类，**禁止**出现可见滚动条，须保留滚轮/触控滚动。
- `wf-scroll-y` 纵向；`wf-scroll-x` 横向；`wf-scroll` 双向。
- Flex 布局中可滚动子项须加 **`min-h-0`**（横向则 `min-w-0`），避免子项撑开父级导致无法滚动。
- 在 **`SelfProcessPage.vue`** 引入 `./workflow.css`；新增面板勿再手写 `[&::-webkit-scrollbar]` 等片段。

### 4.3 上游数据获取（强制）

**所有节点执行器的第一件事必须是获取上游数据，无一例外。**

```typescript
// ✅ 正确：启动即从 upstreamData 读
export async function executeXxx(node, upstreamData, callbacks) {
  const mainData = upstreamData['main'] as Record<string, unknown> | undefined
  // ... 用 mainData
}

// ❌ 错误：忽略 upstreamData，只读 node.params
export async function executeXxx(node, upstreamData, callbacks) {
  const portName = node.params.portName   // 永远是静态默认值
  // 上游数据完全浪费
}
```

节点参数需要引用上游数据时，执行器应支持 `$` 前缀表达式——从 `upstreamData` 按路径取值替代静态默认值。

```
node.params.portName = ''          → 用默认值
node.params.portName = 'COM3'      → 用静态值 'COM3'
node.params.portName = '$main.data.ports[0].name'  → 从 upstreamData 动态取
```

**Why:** 节点连线的本质就是数据传递。忽略上游数据等于切断链路，每个节点变成孤岛。
**How to apply:** 新增/修改执行器时，先写 `const mainData = upstreamData['main']`，再决定是否用它。routing 节点（httpExecutor）由引擎统一处理参数解析，无需逐节点实现。

### 4.4 节点蓝图

- 定义位置：`nodes/definitions/<category>.ts`
- 注册：`nodes/definitions/index.ts` → `allDefs` 数组
- 查询：`utils/nodeRegistryUtils.ts` → `getNodePickerGroups()`
- 节点 `type` 格式：`category.action`（如 `motion.move-abs`、`camera.connect`）
- 分类：`trigger` | `motion` | `camera` | `rs232` | `flow` | `data` | `test`

**新增节点步骤：**

1. 在对应 `nodes/definitions/*.ts` 增加 `NodeTypeDef` 对象
2. 加入该文件的导出数组，`index.ts` 已自动汇总
3. 在 `utils/workflowUtils.ts` 的 `makeDefaultLabel()` 添加默认标签
4. 无需改卡片/菜单/参数面板（自动从注册表读取）

**NodeTypeDef 关键字段：**

```typescript
{
  type: 'motion.move-abs',
  category: 'motion',
  displayName: '绝对移动',
  icon: '↗',
  color: '#1d4ed8',
  params: [ /* 配置表单字段 */ ],
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '错误' }],
  defaults: { /* 与 params[].name 对应 */ },
  routing: { method: 'POST', endpoint: '/api/motion/move/abs', paramLocation: 'body' }
}
```

**输出端口命名规范：**

| HTTP 方法 | main 端口名 | 原因 |
|-----------|------------|------|
| GET | `输出` | 意图是"拿数据"，响应体是节点的产物 |
| POST / PUT / DELETE | `完成` | 意图是"发指令"，响应主要表达是否成功 |
| executeAs（本地执行） | 产生新数据 → `输出`，触发动作 → `完成` | 同上语义 |

error 端口统一叫 `错误`。

### 4.5 VueFlow 约定

- 画布节点 VueFlow `type` 固定为 `workflow-node`（`WORKFLOW_NODE_VF_TYPE`）
- 业务节点类型放在 **`data.nodeType`**，`useWorkflowNode` 必须读 `data.nodeType`，不要读 `props.type`
- 连线类型：`step` | `smoothstep` | `straight` | `default` | `bezier`（见 `types/canvasSettings.ts`）
- 自定义边 `WorkflowCanvas_Edge` 覆盖 `step` / `smoothstep` / `straight`；底部端口固定 `Bottom→Bottom` + `EDGE_PATH_OFFSET`（先向下再拐弯）
- 画布 `id` 与 `useVueFlow({ id: WORKFLOW_VUE_FLOW_ID })` 必须一致（见 `constants/workflowCanvas.ts`）
- 箭头尺寸：`utils/edgeMarkerUtils.ts`（约 8–14px，勿用 `strokeWidth * 10`）

### 4.6 页面布局

```
┌─────────────────────────────────────────────────────────┐
│ 顶栏：标题、保存、返回首页                                │
├──────────┬────────────────────────────┬───────────────┤
│ 流程列表  │  VueFlow 画布               │ 节点/画布 Tab  │
│          │  右键 → 按分类添加节点        │  参数 + 连线设置 │
└──────────┴────────────────────────────┴───────────────┘
```

### 4.7 执行引擎架构

**执行管线：** Trigger 解析 → BFS 图谱遍历 → 逐节点执行分派

```
nodes/executor/
├── nodeExecutor.ts          # 主入口 + BFS 遍历 + 对外 API
│   ├── executeWorkflow()       全局"运行"按钮（只激活 single/multi trigger）
│   ├── executeFromNode()      从指定节点运行（含下游链路）
│   ├── validateWorkflow()     只验证不执行
│   └── traverseAndExecute()   BFS 遍历调度，通过 ExecutionCallbacks 增量通知
├── triggerService.ts        # Trigger 解析
│   ├── findTriggerNodes()     从流程中提取所有 trigger 节点
│   └── resolveGlobalEntryTriggers()  解析 single/multi/manual 入口规则
├── graphTraversal.ts        # 图谱工具（纯函数）
│   ├── findDownstreamNodeIds()  找 main 端口的下游节点 ID
│   └── buildTriggerEntries()   为每个 trigger 构建入口条目
├── nodeRunner.ts            # 单节点分派
│   └── executeSingleNode()  读蓝图 → executeAs → localExecutors / routing → httpExecutor
└── localExecutors/
    ├── index.ts             # executeLocal 注册表（executeAs → 执行函数映射）
    └── delayExecutor.ts     # flow.delay：await sleep(duration)
```

**如何新增本地执行器：**
1. 在 `localExecutors/` 新建文件（如 `conditionExecutor.ts`），导出 `executeXxx(node)` 函数
2. 在 `localExecutors/index.ts` 的 `registry` 中添加映射
3. 蓝图 `executeAs` 字段与 registry key 匹配即可，无需改其他文件

**回调机制：** `ExecutionCallbacks`（定义在 `types/workflowExecution.ts`）：
- `onNodeStarted(nodeId)` — 每节点开始前触发，外部设 running 状态
- `onNodeCompleted(result)` — 每节点完成后触发，外部设 success/failure/warning 状态

引擎不直接操作 store，所有状态更新通过回调由 composable 层完成。

---

## 5. 推荐执行顺序

1. `git status --short` 确认工作区基线
2. 并行读取相关代码、类型、常量，确认修改落点
3. 写出控制合约（目标 / 验收 / 护栏 / 边界 / 风险）
4. 做最小改动，遵守分层（§3.1）
5. 验证：

```bash
cd QomoTech_FrontEnd
npm run typecheck
npm run lint
```

6. 自我 review `git diff`：无越层、无 `export const` 进 `types/`、无 `window` 泄漏到 store/composables
7. 交付说明：改了什么、跑了什么命令、跳过什么验证、残留风险

---

## 6. 提交前检查清单

- [ ] `types/` 无任何 `export const`
- [ ] 新类型在对应模块 `types/` 下
- [ ] 新常量在 `constants/` 下
- [ ] `window.api` 仅出现在 `infra/`
- [ ] 组件命名符合 `[父]_[子].vue`
- [ ] workflow 节点使用 `params`，VueFlow 使用 `data.nodeType`
- [ ] workflow 可滚动区使用 `wf-scroll-y` / `wf-scroll-x`，无可见滚动条
- [ ] `npm run typecheck` 通过（0 错误）
- [ ] `npm run lint` 通过（0 错误）
- [ ] 未意外提交运行时 JSON / 构建产物

---

## 7. 设计原则

- 可读性第一：代码是给人读的
- 拒绝空抽象：分层必须真正降低耦合
- 单一真相来源：不允许双状态
- 只写当下需要的，但要写对
- 错误信息必须能定位问题
- 小步可验证：能分步则不做不可逆大改

---

## 8. 历史踩坑记录

> 只记录本项目中真实发生、有复用价值的问题。格式：**症状 → 根因 → 约束**

| 症状 | 根因 | 约束 |
|------|------|------|
| 节点卡片全是灰色、参数面板显示「未注册」 | VueFlow `props.type` 为 `workflow-node`，未传业务类型 | 业务类型放 `data.nodeType` |
| 小地图全白、看不出流程 | MiniMap 默认节点色 `#fff` 且节点无 `width`/`height` | `node-color` 按分类着色；`toVfNode` 设尺寸；容器用 `--app-card-soft` |
| 删节点/切页 `Cannot read properties of null (reading 'type')` | `#node-workflow-node` 与 `nodeTypes` 双渲染；`useVueFlow()` 无 id；`v-model` setter 为空；MiniMap `v-if` 反复卸载 | 仅用 `nodeTypes`；`WORKFLOW_VUE_FLOW_ID` 对齐；改 `:nodes`/`:edges`；MiniMap 用 `v-show`；删节点走 store |
| 连线横直连、无「先向下」 | `resolveEdgeHandlePositions` 水平时用 Left/Right | 底部端口固定 Bottom→Bottom + `EDGE_PATH_OFFSET` |
| 多输出「完成/错误」圆点贴文字、不在底边 | Handle 的 `relative` 在内层列，外层才有 `pb-3` | 每输出列自带 `relative` + `pb-3`（同输入列） |
| 箭头巨大 | `marker` 尺寸按 `strokeWidth * 10` 计算 | 使用 `edgeMarkerUtils` 8–14px 上限 |
| `types/` 与 `constants/` 混写 | 分层未 enforced | 类型/常量严格分文件 |
| store 内 `window as unknown` | 未隔离 infra | 仅 `infra/` 可访问 `window.api` |
| 旧流程节点无参数 | JSON 使用 `config` 字段 | 加载时合并为 `params` |

---

## 9. 验证命令

```bash
# 前端类型检查
cd QomoTech_FrontEnd && npm run typecheck

# 前端 lint
cd QomoTech_FrontEnd && npm run lint

# 前端格式化
cd QomoTech_FrontEnd && npm run format

# 前端开发
cd QomoTech_FrontEnd && npm run dev

# 后端启动（需 .venv）
cd QomoTech_BackEnd && python run.py
```

---

## 10. 其他模块提示

| 模块 | 说明 |
|------|------|
| `program/` | 配方运行控制，API 在 `program/api/`，逻辑在 `composables/useProgramRunner.ts` |
| `motion/` | 运动控制面板与 HTTP API |
| `camera/` | 相机采集与设置 |
| `shared/api/` | 通用 HTTP 客户端，勿与 workflow 文件 API 混用 |

修改 workflow 时**不要**引用已删除的旧路径：`useSelfProcessStore`、`FlowCanvas`、`selfProcessConfig`、`config` 字段（节点参数）。
