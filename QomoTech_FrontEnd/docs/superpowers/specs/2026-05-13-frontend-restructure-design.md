# QomoTech Frontend Restructure Design Spec

## Status
Approved — proceeding to implementation plan

## Problem
改一个功能要跨 `api/` `stores/` `features/` `view/` `types/` `configs/` 六个目录找文件。逻辑、布局、方法、变量全挤在一个文件里（Home.vue 959行，qomo5pEditor.ts 1162行）。改名担心影响范围，加新功能无从下手。编译报错需要逐个文件排查。

## Goal
改一个模块的功能只进一个目录，5-8 个文件以内。加新模块复制模板即可。修改模块 A 不会导致模块 B 报错。

## Architecture

```
src/renderer/src/
├── app/               # 应用壳层
├── shared/            # 跨模块共享层（被 ≥2 个模块引用的放这里）
├── modules/           # 8 个业务模块（核心重组）
│   ├── auth/          # 授权登录
│   ├── motion/        # 运动控制（主页面）
│   ├── laser/         # 激光控制
│   ├── camera/        # 相机
│   ├── recipe/        # 配方管理
│   ├── workflow/      # 工作流/自定流程
│   ├── editor/        # 5P编辑器/CAD
│   └── settings/      # 系统设置
└── engine/            # 纯逻辑引擎（零 Vue 依赖）
```

### Dependency rules
- `modules/` → `shared/` → `app/`（单向）
- `engine/` 不依赖任何 Vue 代码，纯 TS 函数
- 模块之间不互相直接引用，通过 `shared/` 通信

## Module Breakdown

### 1. auth/ — 授权登录
```
auth/
├── LoginPage.vue
├── LicensePage.vue
├── HelpPage.vue
├── useAuthStore.ts
├── authApi.ts
└── types.ts
```

### 2. motion/ — 运动控制（主控页）
```
motion/
├── HomePage.vue                    # 主控页（~200行纯布局）
├── panels/
│   ├── DriverControlPanel.vue
│   ├── AuxiliaryPanel.vue
│   ├── ControllerSettingsPage.vue
│   ├── ControlPanelBase.vue
│   ├── TaskProgressAside.vue
│   ├── StartProgramPanel.vue
│   └── AxisStatusPanel.vue
├── useMotionStore.ts
├── motionApi.ts
├── types.ts
├── useProgramRunner.ts             # 运行/暂停/急停/跳过
├── useMotionKeyboard.ts            # 键盘快捷键
└── useProgramWebSocket.ts          # WebSocket 连接
```

### 3. laser/ — 激光控制
```
laser/
├── LaserControlPanel.vue
├── LaserSettingsPage.vue
├── useLaserStore.ts
├── laserApi.ts
├── useRs232Polling.ts
└── types.ts
```

### 4. camera/ — 相机
```
camera/
├── CameraControlPanel.vue
├── CameraSettingsPage.vue
├── CameraPreview.vue
├── useCameraStore.ts
├── cameraApi.ts
├── types.ts
└── useCameraReceiver.ts
```

### 5. recipe/ — 配方管理
```
recipe/
├── RecipeManagementPage.vue
├── panels/
│   ├── RecipeParameterPanel.vue
│   ├── RecipeDetailPanel.vue
│   ├── RecipeEditorCard.vue
│   ├── RecipeLibrarySection.vue
│   └── RecipeTopologyDiagram.vue
├── useRecipeStore.ts
├── recipeApi.ts
└── types.ts
```

### 6. workflow/ — 工作流
```
workflow/
├── SelfProcessPage.vue
├── FlowCanvas.vue
├── FlowCanvasConfig.vue
├── FlowNode.vue
├── FlowNodeConfig.vue
├── FlowNodeSelector.vue
├── FlowTaskPanel.vue
├── FlowLogPanel.vue
├── FlowSkipCondition.vue
├── MotionController.vue
├── FlowRunner.ts
├── useSelfProcessStore.ts
├── workflowApi.ts
└── types.ts
```

### 7. editor/ — 5P编辑器/CAD
```
editor/
├── Create5PPage.vue
├── panels/
│   ├── QomoCanvas.vue
│   ├── Qomo3DPreview.vue
│   ├── CreateDiamondParamsDetails.vue
│   └── HomeOperationHelp.vue
├── useQomo5PStore.ts
├── editorApi.ts
├── types.ts
├── cad/
│   ├── importFromCad.ts
│   ├── QomoDxf.ts
│   ├── qomoEntityGeometry.ts
│   ├── QomoProject.ts
│   ├── QomoTo5P.ts
│   ├── QomoToCanvas.ts
│   ├── threeGeometry.ts
│   └── viewport.ts
├── useCadImport.ts
├── useEntityTransform.ts
└── useLayerManager.ts
```

### 8. settings/ — 系统设置
```
settings/
├── ProductionPage.vue
├── useSettingsStore.ts
├── settingsApi.ts
└── types.ts
```

### shared/ — 跨模块共享
```
shared/
├── components/
│   ├── SvgIcon.vue
│   ├── RouteTabs.vue
│   ├── NotificationToast.vue
│   ├── StatusIndicators.vue
│   └── CollapsiblePanelHeader.vue
├── api/
│   ├── httpClient.ts
│   ├── wsClient.ts
│   └── desktopBridge.ts
├── composables/
│   ├── useNotification.ts
│   ├── useAppColorScheme.ts
│   └── useGlobalKeyboard.ts
├── constants.ts
└── types.ts
```

### app/ — 应用壳
```
app/
├── App.vue
├── main.ts
├── router.ts
├── main.css
└── env.d.ts
```

### engine/ — 纯逻辑引擎
```
engine/
├── expressionResolver.ts
├── workflowEngine.ts
└── programValidator.ts
```

## Naming Convention

| Type | Rule | Example |
|------|------|---------|
| Page component | `XxxPage.vue` | `HomePage.vue` |
| Panel/widget | `XxxPanel.vue` | `LaserControlPanel.vue` |
| Dialog/card | `XxxDialog.vue`, `XxxCard.vue` | `RecipeEditorCard.vue` |
| Store | `useXxxStore.ts` | `useMotionStore.ts` |
| API file | `xxxApi.ts` | `motionApi.ts` |
| Types file | `types.ts` (one per module) | `modules/laser/types.ts` |
| Module dir | `lowercase-single-word` | `laser/`, `recipe/` |

## File Size Limits
- Vue SFC: max 300 lines (layout + script + style)
- Store: max 200 lines
- API file: max 200 lines
- Composable: max 250 lines
- Types file: no limit (data only)

## Existing → New File Mapping

Every existing file has a destination. No ambiguity during migration.

### api/ → shared/api/ or module api
| Old | New |
|-----|-----|
| `api/core/base.ts` | `shared/api/httpClient.ts` |
| `api/core/baseWs.ts` + `api/core/wsClient.ts` | `shared/api/wsClient.ts` |
| `api/core/desktopBridge.ts` | `shared/api/desktopBridge.ts` |
| `api/hardware.ts` | `shared/api/hardware.ts` |
| `api/license.ts` | `modules/auth/authApi.ts` |
| `api/camera/camera.ts` + `cameraReceiver.ts` | `modules/camera/cameraApi.ts` |
| `api/device/laser.ts` + `rs232.ts` | `modules/laser/laserApi.ts` |
| `api/motion/*` (all 7 files) | `modules/motion/motionApi.ts` |

### stores/ → module stores
| Old | New |
|-----|-----|
| `stores/auth.ts` + `license.ts` | `modules/auth/useAuthStore.ts` |
| `stores/controllerSettingsStore.ts` + `auxiliaryFunctionPanelStore.ts` | `modules/motion/useMotionStore.ts` |
| `stores/laserSettingsStore.ts` + `rs232WorkbenchStore.ts` | `modules/laser/useLaserStore.ts` |
| `stores/cameraSettingsStore.ts` | `modules/camera/useCameraStore.ts` |
| `stores/recipeSettingsStore.ts` | `modules/recipe/useRecipeStore.ts` |
| `stores/selfProcessStores.ts` | `modules/workflow/useSelfProcessStore.ts` |
| `stores/qomo5pEditor.ts` | `modules/editor/useQomo5PStore.ts` |
| `stores/settings.ts` + `settingsStoreUtils.ts` | `modules/settings/useSettingsStore.ts` |

### types/ → module types or shared
| Old | New |
|-----|-----|
| `types/auth.ts` + `license.ts` | `modules/auth/types.ts` |
| `types/controllerSettings.ts` + `auxiliaryFunctionPanel.ts` | `modules/motion/types.ts` |
| `types/rs232Settings.ts` + `laserSettings.ts` | `modules/laser/types.ts` |
| `types/cameraSettings.ts` | `modules/camera/types.ts` |
| `types/recipeSettings.ts` | `modules/recipe/types.ts` |
| `types/selfProcessTypes.ts` | `modules/workflow/types.ts` |
| `types/Qomo5P.ts` + `diamondTypes.ts` | `modules/editor/types.ts` |
| `types/settings.ts` + `saveJson.ts` | `modules/settings/types.ts` |
| `types/notification.ts` | `shared/types.ts` |

### features/ → module panels
| Old | New |
|-----|-----|
| `features/camera/*` | `modules/camera/` |
| `features/controller-panels/LaserControlPanel.vue` | `modules/laser/LaserControlPanel.vue` |
| `features/controller-panels/DriverControlPanel.vue` | `modules/motion/panels/DriverControlPanel.vue` |
| `features/controller-panels/AuxiliaryFunctionPanel.vue` | `modules/motion/panels/AuxiliaryPanel.vue` |
| `features/controller-panels/ControlPanelBase.vue` | `modules/motion/panels/ControlPanelBase.vue` |
| `features/controller-panels/OutputComponent.vue` | `modules/motion/panels/OutputComponent.vue` |
| `features/embedded-panels/ControllerSettings.vue` | `modules/motion/panels/ControllerSettingsPage.vue` |
| `features/embedded-panels/DetailedRs232Send.vue` | `modules/laser/LaserSettingsPage.vue` |
| `features/embedded-panels/ApiTestPanel.vue` | `modules/settings/ApiTestPanel.vue` |
| `features/home/*` | Split into respective modules |
| `features/recipe/*` | `modules/recipe/panels/` |
| `features/workflow/*` | `modules/workflow/` |
| `features/modeling/*` | `modules/editor/panels/` |

### view/ → module pages
| Old | New |
|-----|-----|
| `view/Home.vue` | `modules/motion/HomePage.vue` |
| `view/Production.vue` | `modules/settings/ProductionPage.vue` |
| `view/auth/Login.vue` | `modules/auth/LoginPage.vue` |
| `view/auth/License.vue` | `modules/auth/LicensePage.vue` |
| `view/auth/Help.vue` | `modules/auth/HelpPage.vue` |
| `view/settings/CameraSettings.vue` | `modules/camera/CameraSettingsPage.vue` |
| `view/settings/RecipeManagement.vue` | `modules/recipe/RecipeManagementPage.vue` |
| `view/editor/Create5P.vue` | `modules/editor/Create5PPage.vue` |
| `view/editor/SelfProcess.vue` | `modules/workflow/SelfProcessPage.vue` |

### configs/ → absorbed into module types.ts
Each config file's defaults/constants merged into its module's `types.ts`.
`configs/constants.ts` → `shared/constants.ts`.

### composables/ → module or shared
| Old | New |
|-----|-----|
| `composables/useRs232Polling.ts` | `modules/laser/useRs232Polling.ts` |
| `composables/useBackendStatus.ts` | `shared/composables/useBackendStatus.ts` |
| `composables/useSettingsPages.ts` | `modules/settings/useSettingsPages.ts` |

### utils/ → respective modules
| Old | New |
|-----|-----|
| `utils/globalKeyboard.ts` | `shared/composables/useGlobalKeyboard.ts` |
| `utils/Qomo5P/*` (all 7 files) | `modules/editor/cad/` |
| `utils/cameraValidation.ts` | `modules/camera/` (merged into cameraApi) |
| `utils/controllerValidation.ts` | `modules/motion/` (merged into motionApi) |
| `utils/recipeValidation.ts` | `modules/recipe/` (merged into recipeApi) |
| `utils/rs232Validation.ts` | `modules/laser/` (merged into laserApi) |
| `utils/selfProcessUtils.ts` | `modules/workflow/` |
| `utils/settings.ts` | `modules/settings/` |
| `utils/auth.ts` | `modules/auth/` |

## Migration Strategy

分 4 个阶段，每个阶段可独立验证：

**Phase 1: 基础层迁移**（不碰业务代码）
- 创建 `shared/api/` 移动 httpClient/wsClient/desktopBridge
- 创建 `shared/components/` 移动通用 UI 组件
- 创建 `shared/composables/` 移动通用 composables
- 验证编译通过

**Phase 2: 模块迁移**（逐个模块）
- 先迁移最独立的模块：`auth/`
- 再迁移中复杂度模块：`laser/`, `camera/`
- 再迁移核心模块：`motion/`（需拆分 Home.vue）
- 后迁移复杂模块：`recipe/`, `workflow/`, `editor/`, `settings/`
- 每迁移一个模块验证编译通过

**Phase 3: 大文件拆分**
- 拆分 `Home.vue` → `HomePage.vue` + 3 composables
- 拆分 `qomo5pEditor.ts` → store + composables
- 拆分 `ControllerSettings.vue` → 子面板

**Phase 4: 清理**
- 删除旧文件/旧目录
- 统一所有 import 路径为 `@/modules/xxx`
- 运行 typecheck 全量检查

## Risk Mitigation
- 每步用 `git commit` 保存检查点
- 每个阶段结束运行 `npm run typecheck` 验证无类型错误
- 旧文件先保留不删，新文件生效后再清理
- 路由路径不变，保证外部无感知
