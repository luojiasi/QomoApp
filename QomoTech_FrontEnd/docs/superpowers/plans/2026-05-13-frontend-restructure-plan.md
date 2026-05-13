# Frontend Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize QomoTech_FrontEnd from scattered `api/`/`stores/`/`features/`/`view/`/`types/`/`configs/` into 8 self-contained business modules under `modules/`, with a `shared/` layer and `app/` shell.

**Architecture:** Each business module (auth, motion, laser, camera, recipe, workflow, editor, settings) gets its own directory containing its page, panels, store, API, and types — all co-located. Cross-module code lives in `shared/`. Pure logic stays in `engine/`.

**Tech Stack:** Electron + Vue 3 + TypeScript + Pinia + Tailwind CSS 4

**Verification:** `npm run typecheck` must pass after each task before committing.

---

## Pre-flight

- [ ] **Step 1: Create all new directory structure**

```powershell
$base = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dirs = @(
    "$base\app",
    "$base\shared\api",
    "$base\shared\components",
    "$base\shared\composables",
    "$base\modules\auth",
    "$base\modules\motion\panels",
    "$base\modules\laser",
    "$base\modules\camera",
    "$base\modules\recipe\panels",
    "$base\modules\workflow",
    "$base\modules\editor\panels",
    "$base\modules\editor\cad",
    "$base\modules\settings",
    "$base\engine"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Path $d -Force }
```

- [ ] **Step 2: Verify directories created**

```powershell
Get-ChildItem -Path "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src" -Directory | Select-Object Name
```
Expected: See `app`, `shared`, `modules`, `engine` alongside existing dirs.

---

## Phase 1: Foundation Layer Migration

### Task 1: Move shared API layer

**Files:**
- Create: `shared/api/httpClient.ts`, `shared/api/wsClient.ts`, `shared/api/desktopBridge.ts`, `shared/api/hardware.ts`
- Modify: ALL existing files that import from `api/core/base`, `api/core/baseWs`, `api/core/wsClient`, `api/core/desktopBridge`

- [ ] **Step 1: Copy `api/core/base.ts` → `shared/api/httpClient.ts`**

```powershell
Copy-Item "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\api\core\base.ts" "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\api\httpClient.ts"
```

- [ ] **Step 2: Merge `api/core/baseWs.ts` + `api/core/wsClient.ts` → `shared/api/wsClient.ts`**

Read both files and write combined content to `shared/api/wsClient.ts`. (baseWs.ts content first, then append wsClient.ts exports without duplicate imports.)

- [ ] **Step 3: Copy `api/core/desktopBridge.ts` → `shared/api/desktopBridge.ts`**

```powershell
Copy-Item "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\api\core\desktopBridge.ts" "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\api\desktopBridge.ts"
```

- [ ] **Step 4: Copy `api/hardware.ts` → `shared/api/hardware.ts`**

```powershell
Copy-Item "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\api\hardware.ts" "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\api\hardware.ts"
```

- [ ] **Step 5: Update ALL imports from `api/core/base` to `shared/api/httpClient`**

Search all files importing from `api/core/base` and update:
```typescript
// OLD:
import { apiCall, getBackendApiUrl, getBackendBaseUrl, withApiQuery, getCameraStreamUrl } from '../api/core/base'
// NEW:
import { apiCall, getBackendApiUrl, getBackendBaseUrl, withApiQuery, getCameraStreamUrl } from '@/shared/api/httpClient'
```

Affected files (check each):
- `api/camera/camera.ts`
- `api/device/laser.ts`
- `api/device/rs232.ts`
- `api/motion/axis.ts`
- `api/motion/bootstrap.ts`
- `api/motion/connect.ts`
- `api/motion/index.ts`
- `api/motion/io.ts`
- `api/motion/motionExecute.ts`
- `api/motion/program.ts`
- `api/license.ts`

- [ ] **Step 6: Update ALL imports from `api/core/baseWs` to `@/shared/api/wsClient`**

- [ ] **Step 7: Update ALL imports from `api/core/desktopBridge` to `@/shared/api/desktopBridge`**

- [ ] **Step 8: Update ALL imports from `api/hardware` to `@/shared/api/hardware`**

- [ ] **Step 9: Verify — run typecheck**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"; npm run typecheck
```
Expected: zero errors. If errors, fix import paths in affected files.

---

### Task 2: Move shared UI components

**Files:**
- Create: `shared/components/*.vue` (5 files copied)
- Modify: all files importing from `components/ui/*`

- [ ] **Step 1: Copy all 5 UI components**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\components\ui"
$dst = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\components"
Copy-Item "$src\SvgIcon.vue" "$dst\SvgIcon.vue"
Copy-Item "$src\RouteTabs.vue" "$dst\RouteTabs.vue"
Copy-Item "$src\NotificationToast.vue" "$dst\NotificationToast.vue"
Copy-Item "$src\StatusIndicators.vue" "$dst\StatusIndicators.vue"
Copy-Item "$src\CollapsiblePanelHeader.vue" "$dst\CollapsiblePanelHeader.vue"
```

- [ ] **Step 2: Update ALL imports from `components/ui/Xxx` to `@/shared/components/Xxx`**

Search pattern: `from.*components/ui/` or `@/components/ui/`

Affected files include:
- `App.vue` — imports `NotificationToast`
- `view/Home.vue` — imports `RouteTabs`, `StatusIndicators`, `SvgIcon`
- `features/camera/CameraControlPanel.vue` — imports `ControlPanelBase`
- All other feature panels using `ControlPanelBase`

- [ ] **Step 3: Run typecheck**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"; npm run typecheck
```

---

### Task 3: Move shared composables

**Files:**
- Create: `shared/composables/useNotification.ts`, `useAppColorScheme.ts`, `useGlobalKeyboard.ts`, `useBackendStatus.ts`
- Modify: all importers

- [ ] **Step 1: Copy composables**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\composables"
$dst = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\composables"
Copy-Item "$src\useNotification.ts" "$dst\useNotification.ts"
Copy-Item "$src\useAppColorScheme.ts" "$dst\useAppColorScheme.ts"
Copy-Item "$src\useBackendStatus.ts" "$dst\useBackendStatus.ts"
```

- [ ] **Step 2: Transform `utils/globalKeyboard.ts` → `shared/composables/useGlobalKeyboard.ts`**

Rename functions to composable pattern:
- `subscribeGlobalKeyboard` → keep as-is or `useGlobalKeyboard().subscribe`
- `dispatchGlobalKeyboard` → keep as-is
- Wrap in `export function useGlobalKeyboard() { ... }` if needed

- [ ] **Step 3: Update ALL imports**

```typescript
// OLD:
import { notify } from '../composables/useNotification'
// NEW:
import { notify } from '@/shared/composables/useNotification'
```

- [ ] **Step 4: Run typecheck**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"; npm run typecheck
```

---

### Task 4: Move shared types and constants

**Files:**
- Create: `shared/types.ts`, `shared/constants.ts`
- Modify: importers of `types/notification.ts`, `configs/constants.ts`

- [ ] **Step 1: Copy `types/notification.ts` → `shared/types.ts`**

```powershell
Copy-Item "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\types\notification.ts" "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\types.ts"
```

- [ ] **Step 2: Copy `configs/constants.ts` → `shared/constants.ts`**

```powershell
Copy-Item "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\configs\constants.ts" "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\shared\constants.ts"
```

- [ ] **Step 3: Update imports in all files that import from `types/notification` or `configs/constants`**

- [ ] **Step 4: Run typecheck**

---

### Task 5: Create app/ shell

**Files:**
- Create: `app/App.vue`, `app/main.ts`, `app/router.ts`, `app/main.css`, `app/env.d.ts`
- Modify: `src/renderer/index.html` (update entry point)

- [ ] **Step 1: Copy `main.ts` → `app/main.ts`, update imports to use `@/shared/` paths**

- [ ] **Step 2: Copy `main.css` → `app/main.css`**

- [ ] **Step 3: Copy `env.d.ts` → `app/env.d.ts`**

- [ ] **Step 4: Copy `App.vue` → `app/App.vue`, update imports to use `@/shared/` paths**

- [ ] **Step 5: Copy `router.ts` → `app/router.ts`, update all component imports**

For now, keep route component imports pointing to old paths (they'll be updated in Phase 2).

- [ ] **Step 6: Update `index.html` entry point**

```html
<!-- OLD -->
<script type="module" src="./src/main.ts"></script>
<!-- NEW -->
<script type="module" src="./src/app/main.ts"></script>
```

- [ ] **Step 7: Run typecheck**

---

### Task 6: Move engine/ files

**Files:**
- Create: `engine/expressionResolver.ts`, `engine/workflowEngine.ts`

- [ ] **Step 1: Copy engine files (no import changes needed — they're pure logic)**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\engine"
$dst = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src\engine"
Copy-Item "$src\expressionResolver.ts" "$dst\expressionResolver.ts"
Copy-Item "$src\workflowEngine.ts" "$dst\workflowEngine.ts"
```

- [ ] **Step 2: Update imports in files that import from `engine/`**

If any files import from `../engine/` or `@/engine/`, update to new paths.

- [ ] **Step 3: Run typecheck**

---

### Task 7: Phase 1 commit

- [ ] **Step 1: Commit Phase 1**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"
git add src/renderer/src/shared/ src/renderer/src/app/ src/renderer/src/engine/
git add -u
git commit -m "refactor(phase1): move shared layer, app shell, engine to new structure"
```

---

## Phase 2: Module Migration (one module at a time)

### Task 8: Migrate auth module

**Files:**
- Create: `modules/auth/LoginPage.vue`, `LicensePage.vue`, `HelpPage.vue`, `useAuthStore.ts`, `authApi.ts`, `types.ts`
- Modify: `app/router.ts` (update route component imports)

- [ ] **Step 1: Create module files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\auth"

# Pages
Copy-Item "$src\view\auth\Login.vue" "$dst\LoginPage.vue"
Copy-Item "$src\view\auth\License.vue" "$dst\LicensePage.vue"
Copy-Item "$src\view\auth\Help.vue" "$dst\HelpPage.vue"

# Store: merge stores/auth.ts + stores/license.ts → useAuthStore.ts
# API: copy and merge api/license.ts → authApi.ts
# Types: merge types/auth.ts + types/license.ts → types.ts
```

- [ ] **Step 2: Merge `stores/auth.ts` + `stores/license.ts` → `modules/auth/useAuthStore.ts`**

Combine both store definitions into one unified auth store. Keep all existing exports but from one file.

- [ ] **Step 3: Copy and rename `api/license.ts` → `modules/auth/authApi.ts`**

Update internal imports to use `@/shared/api/httpClient`.

- [ ] **Step 4: Merge `types/auth.ts` + `types/license.ts` → `modules/auth/types.ts`**

- [ ] **Step 5: Update `app/router.ts`**

```typescript
// OLD:
import Login from './view/auth/Login.vue'
import License from './view/auth/License.vue'
import Help from './view/auth/Help.vue'
// NEW:
import LoginPage from '@/modules/auth/LoginPage.vue'
import LicensePage from '@/modules/auth/LicensePage.vue'
import HelpPage from '@/modules/auth/HelpPage.vue'

// Update route components:
{ path: '/login', name: 'login', component: LoginPage, ... }
{ path: '/license', name: 'license', component: LicensePage, ... }
{ path: '/help', name: 'help', component: HelpPage, ... }
```

- [ ] **Step 6: Update ALL cross-module imports**

Search for imports from `stores/auth`, `stores/license`, `types/auth`, `types/license`, `api/license`, `utils/auth` — update to `@/modules/auth/useAuthStore`, `@/modules/auth/authApi`, `@/modules/auth/types`.

- [ ] **Step 7: Run typecheck**

- [ ] **Step 8: Commit**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"
git add src/renderer/src/modules/auth/
git add -u
git commit -m "refactor(phase2-auth): migrate auth to modules/auth"
```

---

### Task 9: Migrate laser module

**Files:**
- Create: `modules/laser/LaserControlPanel.vue`, `LaserSettingsPage.vue`, `useLaserStore.ts`, `laserApi.ts`, `useRs232Polling.ts`, `types.ts`

- [ ] **Step 1: Create module files — panels**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\laser"

Copy-Item "$src\features\controller-panels\LaserControlPanel.vue" "$dst\LaserControlPanel.vue"
Copy-Item "$src\features\embedded-panels\DetailedRs232Send.vue" "$dst\LaserSettingsPage.vue"
Copy-Item "$src\composables\useRs232Polling.ts" "$dst\useRs232Polling.ts"
```

- [ ] **Step 2: Merge `stores/laserSettingsStore.ts` + `stores/rs232WorkbenchStore.ts` → `useLaserStore.ts`**

- [ ] **Step 3: Merge `api/device/laser.ts` + `api/device/rs232.ts` → `laserApi.ts`**

- [ ] **Step 4: Merge `types/rs232Settings.ts` + relevant laser types → `types.ts`**

Also absorb `configs/lasermanufacturer.ts` constants into `types.ts`.

- [ ] **Step 5: Update internal imports in all new files**

All files in `modules/laser/` should import from `@/shared/...` or relative `./xxx`.

- [ ] **Step 6: Update `app/router.ts`** — change `detailed-rs232-send` route component to `LaserSettingsPage`

- [ ] **Step 7: Update ALL cross-module imports** — find files importing from old laser/rs232 paths

- [ ] **Step 8: Run typecheck and commit**

---

### Task 10: Migrate camera module

**Files:**
- Create: `modules/camera/CameraControlPanel.vue`, `CameraSettingsPage.vue`, `CameraPreview.vue`, `useCameraStore.ts`, `cameraApi.ts`, `useCameraReceiver.ts`, `types.ts`

- [ ] **Step 1: Copy camera files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\camera"

Copy-Item "$src\features\camera\CameraControlPanel.vue" "$dst\CameraControlPanel.vue"
Copy-Item "$src\features\camera\cameraPic.vue" "$dst\CameraPreview.vue"
Copy-Item "$src\view\settings\CameraSettings.vue" "$dst\CameraSettingsPage.vue"
Copy-Item "$src\stores\cameraSettingsStore.ts" "$dst\useCameraStore.ts"
```

- [ ] **Step 2: Merge `api/camera/camera.ts` + `cameraReceiver.ts` → `cameraApi.ts`**

Also absorb `utils/cameraValidation.ts` into `cameraApi.ts`.

- [ ] **Step 3: Transform `cameraReceiver.ts` logic → `useCameraReceiver.ts` composable**

```typescript
// useCameraReceiver.ts
export function useCameraReceiver() {
  // Start/stop receiver, manage connection state
  // Return reactive state
}
```

- [ ] **Step 4: Copy `types/cameraSettings.ts` → `types.ts`, absorb `configs/cameraSettings.ts`**

- [ ] **Step 5: Update router and all cross-module imports**

- [ ] **Step 6: Run typecheck and commit**

---

### Task 11: Migrate motion module (structure only, no Home.vue split yet)

**Files:**
- Create: `modules/motion/HomePage.vue` (copy of Home.vue for now), `panels/*`, `useMotionStore.ts`, `motionApi.ts`, `types.ts`

- [ ] **Step 1: Copy all motion-related files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\motion"
$dstp = "$dst\panels"

Copy-Item "$src\view\Home.vue" "$dst\HomePage.vue"
Copy-Item "$src\features\controller-panels\DriverControlPanel.vue" "$dstp\DriverControlPanel.vue"
Copy-Item "$src\features\controller-panels\AuxiliaryFunctionPanel.vue" "$dstp\AuxiliaryPanel.vue"
Copy-Item "$src\features\controller-panels\ControlPanelBase.vue" "$dstp\ControlPanelBase.vue"
Copy-Item "$src\features\controller-panels\OutputComponent.vue" "$dstp\OutputComponent.vue"
Copy-Item "$src\features\embedded-panels\ControllerSettings.vue" "$dstp\ControllerSettingsPage.vue"
Copy-Item "$src\features\home\TaskProgressAside.vue" "$dstp\TaskProgressAside.vue"
Copy-Item "$src\features\home\StratProgramRunning.vue" "$dstp\StartProgramPanel.vue"
```

- [ ] **Step 2: Merge stores → `useMotionStore.ts`**

Combine `controllerSettingsStore.ts` + `auxiliaryFunctionPanelStore.ts`.

- [ ] **Step 3: Merge all `api/motion/*.ts` files → `motionApi.ts`**

Merge `axis.ts` + `bootstrap.ts` + `connect.ts` + `index.ts` + `io.ts` + `motionExecute.ts` + `program.ts`.

Also absorb `utils/controllerValidation.ts`.

- [ ] **Step 4: Merge types → `types.ts`**

Merge `types/controllerSettings.ts` + `types/auxiliaryFunctionPanel.ts`.
Absorb `configs/controllerSettings.ts` defaults.

- [ ] **Step 5: Update `app/router.ts`** — `/home` → `HomePage`, `/controller-settings` → `ControllerSettingsPage`

- [ ] **Step 6: Update ALL internal imports within new files to use `@/shared/...` and relative paths**

- [ ] **Step 7: Update ALL cross-module imports**

This is the most affected module since many things import from controllerSettings, motion APIs, etc.

- [ ] **Step 8: Run typecheck and commit**

---

### Task 12: Migrate recipe module

- [ ] **Step 1: Copy recipe files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\recipe"
$dstp = "$dst\panels"

Copy-Item "$src\features\recipe\HomeRecipeParameterPanel.vue" "$dstp\RecipeParameterPanel.vue"
Copy-Item "$src\features\recipe\RecipeDetailFieldPanel.vue" "$dstp\RecipeDetailPanel.vue"
Copy-Item "$src\features\recipe\RecipeEditorCard.vue" "$dstp\RecipeEditorCard.vue"
Copy-Item "$src\features\recipe\RecipeLibrarySection.vue" "$dstp\RecipeLibrarySection.vue"
Copy-Item "$src\features\recipe\RecipeTopologyDiagram.vue" "$dstp\RecipeTopologyDiagram.vue"
Copy-Item "$src\view\settings\RecipeManagement.vue" "$dst\RecipeManagementPage.vue"
Copy-Item "$src\stores\recipeSettingsStore.ts" "$dst\useRecipeStore.ts"
```

- [ ] **Step 2: Merge types**

Copy `types/recipeSettings.ts` → `modules/recipe/types.ts`, absorb `configs/recipeSettings.ts` defaults into it.

- [ ] **Step 3: Absorb `utils/recipeValidation.ts` into `modules/recipe/`** (merge into store or keep separate)

- [ ] **Step 4: Update internal imports** — all `modules/recipe/` files import from `@/shared/...` and `./xxx`

- [ ] **Step 5: Update router** — `/recipe-management` → `RecipeManagementPage`

```typescript
// app/router.ts
import RecipeManagementPage from '@/modules/recipe/RecipeManagementPage.vue'
```

- [ ] **Step 6: Update cross-module imports** — search for old `stores/recipeSettingsStore`, `types/recipeSettings`, `features/recipe/` imports

- [ ] **Step 7: Run typecheck and commit**

### Task 13: Migrate workflow module

- [ ] **Step 1: Copy workflow files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\workflow"

Copy-Item "$src\features\workflow\FlowCanvas.vue" "$dst\FlowCanvas.vue"
Copy-Item "$src\features\workflow\FlowCanvasConfig.vue" "$dst\FlowCanvasConfig.vue"
Copy-Item "$src\features\workflow\FlowLogPanel.vue" "$dst\FlowLogPanel.vue"
Copy-Item "$src\features\workflow\FlowNode.vue" "$dst\FlowNode.vue"
Copy-Item "$src\features\workflow\FlowNodeConfig.vue" "$dst\FlowNodeConfig.vue"
Copy-Item "$src\features\workflow\FlowNodeSelector.vue" "$dst\FlowNodeSelector.vue"
Copy-Item "$src\features\workflow\FlowRunner.ts" "$dst\FlowRunner.ts"
Copy-Item "$src\features\workflow\FlowSkipCondition.vue" "$dst\FlowSkipCondition.vue"
Copy-Item "$src\features\workflow\FlowTaskPanel.vue" "$dst\FlowTaskPanel.vue"
Copy-Item "$src\features\workflow\MotionController.vue" "$dst\MotionController.vue"
Copy-Item "$src\view\editor\SelfProcess.vue" "$dst\SelfProcessPage.vue"
Copy-Item "$src\stores\selfProcessStores.ts" "$dst\useSelfProcessStore.ts"
```

- [ ] **Step 2: Merge types** — `types/selfProcessTypes.ts` → `modules/workflow/types.ts`

- [ ] **Step 3: Absorb `utils/selfProcessUtils.ts`** into `modules/workflow/`

- [ ] **Step 4: Update router** — `/self-process` → `SelfProcessPage`

```typescript
import SelfProcessPage from '@/modules/workflow/SelfProcessPage.vue'
```

- [ ] **Step 5: Update all imports, run typecheck, commit**

### Task 14: Migrate editor module

- [ ] **Step 1: Copy editor files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\editor"
$dstp = "$dst\panels"
$dstc = "$dst\cad"

Copy-Item "$src\view\editor\Create5P.vue" "$dst\Create5PPage.vue"
Copy-Item "$src\features\modeling\QomoCanvas.vue" "$dstp\QomoCanvas.vue"
Copy-Item "$src\features\modeling\Qomo3DPreview.vue" "$dstp\Qomo3DPreview.vue"
Copy-Item "$src\features\modeling\CreateDiamondParamsDetails.vue" "$dstp\CreateDiamondParamsDetails.vue"
Copy-Item "$src\features\home\HomeOperationHelp.vue" "$dstp\HomeOperationHelp.vue"
Copy-Item "$src\features\home\showAndDrawInHome.vue" "$dstp\ShowAndDrawPanel.vue"
Copy-Item "$src\stores\qomo5pEditor.ts" "$dst\useQomo5PStore.ts"
Copy-Item "$src\utils\Qomo5P\importFromCad.ts" "$dstc\importFromCad.ts"
Copy-Item "$src\utils\Qomo5P\QomoDxf.ts" "$dstc\QomoDxf.ts"
Copy-Item "$src\utils\Qomo5P\qomoEntityGeometry.ts" "$dstc\qomoEntityGeometry.ts"
Copy-Item "$src\utils\Qomo5P\QomoProject.ts" "$dstc\QomoProject.ts"
Copy-Item "$src\utils\Qomo5P\QomoTo5P.ts" "$dstc\QomoTo5P.ts"
Copy-Item "$src\utils\Qomo5P\QomoToCanvas.ts" "$dstc\QomoToCanvas.ts"
Copy-Item "$src\utils\Qomo5P\threeGeometry.ts" "$dstc\threeGeometry.ts"
Copy-Item "$src\utils\Qomo5P\viewport.ts" "$dstc\viewport.ts"
```

- [ ] **Step 2: Merge types** — `types/Qomo5P.ts` + `types/diamondTypes.ts` → `modules/editor/types.ts`, absorb `configs/diamondConfigs.ts` + `configs/qomo5pSettings.ts`

- [ ] **Step 3: Update router** — `/create-5p` → `Create5PPage`

```typescript
import Create5PPage from '@/modules/editor/Create5PPage.vue'
```

- [ ] **Step 4: Update all cad/ internal imports** to use relative `./` paths

- [ ] **Step 5: Run typecheck, commit**

### Task 15: Migrate settings module

- [ ] **Step 1: Copy settings files**

```powershell
$src = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
$dst = "$src\modules\settings"

Copy-Item "$src\view\Production.vue" "$dst\ProductionPage.vue"
Copy-Item "$src\features\embedded-panels\ApiTestPanel.vue" "$dst\ApiTestPanel.vue"
Copy-Item "$src\composables\useSettingsPages.ts" "$dst\useSettingsPages.ts"
```

- [ ] **Step 2: Merge `stores/settings.ts` + `settingsStoreUtils.ts` → `useSettingsStore.ts`**

- [ ] **Step 3: Merge `types/settings.ts` + `types/saveJson.ts` → `types.ts`**
Also absorb `configs/settings.ts` and `configs/storageKeys.ts` into `types.ts`.

- [ ] **Step 4: Absorb `utils/settings.ts` into `useSettingsStore.ts`**

- [ ] **Step 5: Update router** — `/production` → `ProductionPage`

```typescript
import ProductionPage from '@/modules/settings/ProductionPage.vue'
```

- [ ] **Step 6: Run typecheck, commit**

---

## Phase 3: Split Oversized Files

### Task 16: Split Home.vue → HomePage.vue + composables

**Goal:** Reduce `modules/motion/HomePage.vue` from 959 lines to ~200 lines layout + 3 composables.

- [ ] **Step 1: Extract `useProgramWebSocket.ts`**

```typescript
// modules/motion/useProgramWebSocket.ts
import { ref, onUnmounted } from 'vue'
import { getStartProgramStatusWsUrl } from '@/shared/api/wsClient'

export function useProgramWebSocket() {
  const programRunning = ref(false)
  const programPaused = ref(false)
  const programTaskCount = ref(0)
  const currentTaskIndex = ref(0)
  const currentTaskJindubaifenbi = ref(0)

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectEnabled = true

  function connect() { /* ... existing connectProgramStatusWebSocket logic ... */ }
  function disconnect() { reconnectEnabled = false; /* ... existing stop logic ... */ }
  function applyStatus(data: any) { /* ... existing applyStartProgramStatusPayload logic ... */ }

  return {
    programRunning, programPaused, programTaskCount,
    currentTaskIndex, currentTaskJindubaifenbi,
    connect, disconnect, applyStatus
  }
}
```

- [ ] **Step 2: Extract `useProgramRunner.ts`**

```typescript
// modules/motion/useProgramRunner.ts
import { ref, computed } from 'vue'
import { startProgram, startProgramControl, getStartProgramStatus } from './motionApi'
import { useNotification } from '@/shared/composables/useNotification'
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'

const PROGRAM_STARTED_AT_KEY = 'qomo.startProgram.startedAtMs'

export function useProgramRunner() {
  const { error, success } = useNotification()
  const qomo5pStore = useQomo5PStore()

  const programStartedAtMs = ref<number | null>(null)
  const programElapsedMs = ref(0)

  let elapsedTimer: ReturnType<typeof setInterval> | null = null

  const elapsedText = computed(() => formatElapsedMs(programElapsedMs.value))

  async function run(payload: Record<string, unknown>) { /* ... onRunClick logic ... */ }
  async function pauseToggle() { /* ... onPauseToggleClick logic ... */ }
  async function reset() { /* ... onResetAlarmsClick logic ... */ }
  async function estop() { /* ... onEstopClick logic ... */ }
  async function skip() { /* ... onSkipTaskClick logic ... */ }
  async function syncOnEnter() { /* ... syncProgramStatusOnEnter logic ... */ }

  function startTimer() { /* ... */ }
  function stopTimer() { /* ... */ }

  return { programStartedAtMs, programElapsedMs, elapsedText, run, pauseToggle, reset, estop, skip, syncOnEnter, startTimer, stopTimer }
}

function formatElapsedMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(safe / 1000)
  const hh = Math.floor(totalSeconds / 3600)
  const mm = Math.floor((totalSeconds % 3600) / 60)
  const ss = totalSeconds % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
```

- [ ] **Step 3: Extract `useMotionKeyboard.ts`**

Move all keyboard shortcut logic (arrow keys, F1-F4, QWER, H key, alt combinations, ctrl combinations) from Home.vue into this composable.

```typescript
// modules/motion/useMotionKeyboard.ts
import { ref } from 'vue'
import { subscribeGlobalKeyboard } from '@/shared/composables/useGlobalKeyboard'
import { useMotionStore } from './useMotionStore'
import { moveMotionAxisRel, moveMotionAxisAbs, rotateUAxisByAngle, rotateRAxisByTurns, zeroMotionAxis, setMotionIoOutput, syncProduct4PCenterRotation } from './motionApi'
import { useNotification } from '@/shared/composables/useNotification'

export function useMotionKeyboard() {
  const { error, success } = useNotification()
  const motionStore = useMotionStore()

  const Qkey = ref(false)
  const Wkey = ref(false)
  const Ekey = ref(false)
  const Rkey = ref(false)
  const moveStep = ref(1)

  // ... all keyboard handlers ...
  const handler = (e: KeyboardEvent) => { /* existing subscribeGlobalKeyboard callback */ }

  const unsubscribe = subscribeGlobalKeyboard(handler)

  return { Qkey, Wkey, Ekey, Rkey, moveStep, unsubscribe }
}
```

- [ ] **Step 4: Rewrite `HomePage.vue` to use composables**

```vue
<script setup lang="ts">
import RouteTabs from '@/shared/components/RouteTabs.vue'
import HomeUserBar from '@/features/home/HomeUserBar.vue'  // TODO: move to motion
import StatusIndicators from '@/shared/components/StatusIndicators.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { deviceFeatureRoutes } from '@/app/router'
import { useProgramWebSocket } from './useProgramWebSocket'
import { useProgramRunner } from './useProgramRunner'
import { useMotionKeyboard } from './useMotionKeyboard'
import { useMotionStore } from './useMotionStore'
import { bootstrapControllerOnce } from './motionApi'
import { syncRs232Workbench } from '@/modules/laser/laserApi'
import { useLaserStore } from '@/modules/laser/useLaserStore'
import { onMounted, onUnmounted } from 'vue'

const featureLinks = deviceFeatureRoutes
const { error, success } = useNotification()
const motionStore = useMotionStore()

const {
  programRunning, programPaused, programTaskCount,
  currentTaskIndex, currentTaskJindubaifenbi,
  connect: connectWs, disconnect: disconnectWs
} = useProgramWebSocket()

const {
  programElapsedMs, elapsedText,
  run, pauseToggle, reset, estop, skip, syncOnEnter
} = useProgramRunner()

const { Qkey, Wkey, Ekey, Rkey, moveStep, unsubscribe: unsubKeyboard } = useMotionKeyboard()

onMounted(async () => {
  await motionStore.load()
  await bootstrapControllerOnce(motionStore.settings)
  // sync RS232, sync program status, connect WS...
  connectWs()
})

onUnmounted(() => {
  unsubKeyboard()
  disconnectWs()
})
</script>

<template>
  <!-- Simplified layout: toolbar, panels, main content -->
  <div class="home-toolbar">
    <RouteTabs :links="featureLinks" :show-home-link="false" />
    <StatusIndicators />
    <button @click="run"><SvgIcon icon-name="icon-refresh" /></button>
    <!-- Run/Pause/Reset/Estop/Skip buttons -->
  </div>
  <section class="right-panels"><!-- panels --></section>
  <main class="main-content"><!-- camera + canvas --></main>
</template>
```

- [ ] **Step 5: Run typecheck, commit**

---

### Task 17: Split `qomo5pEditor.ts` store (1162 lines)

**Goal:** Split into `useQomo5PStore.ts` (core state ~200 lines), `useCadImport.ts` (~150 lines), `useEntityTransform.ts` (~200 lines), `useLayerManager.ts` (~100 lines).

- [ ] **Step 1: Create `useCadImport.ts`** — extract all CAD import logic (DXF parsing, file reading)

- [ ] **Step 2: Create `useEntityTransform.ts`** — extract entity move/rotate/scale/transform logic

- [ ] **Step 3: Create `useLayerManager.ts`** — extract layer CRUD logic

- [ ] **Step 4: Trim `useQomo5PStore.ts`** to only core state + project serialization (~200 lines)

- [ ] **Step 5: Update all imports, run typecheck, commit**

---

### Task 18: Split `ControllerSettingsPage.vue` (911 lines)

**Goal:** Split into sub-panels by parameter category.

- [ ] **Step 1: Create `panels/AxisParamsPanel.vue`** — axis number, speed, accel, etc.

- [ ] **Step 2: Create `panels/LimitParamsPanel.vue`** — hard limit, soft limit config

- [ ] **Step 3: Create `panels/HomingParamsPanel.vue`** — homing parameters

- [ ] **Step 4: Create `panels/CommParamsPanel.vue`** — communication settings (IP, port)

- [ ] **Step 5: Rewrite `ControllerSettingsPage.vue`** to compose sub-panels

- [ ] **Step 6: Run typecheck, commit**

---

## Phase 4: Cleanup

### Task 19: Delete old files

- [ ] **Step 1: Delete old directories**

```powershell
$base = "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src"
Remove-Item -Recurse -Force "$base\api"
Remove-Item -Recurse -Force "$base\stores\pinia.ts"  # keep only if moved
Remove-Item -Recurse -Force "$base\components"
Remove-Item -Recurse -Force "$base\features"
Remove-Item -Recurse -Force "$base\view"
Remove-Item -Recurse -Force "$base\configs"
Remove-Item -Recurse -Force "$base\composables"
Remove-Item -Recurse -Force "$base\utils"
Remove-Item -Force "$base\main.ts"
Remove-Item -Force "$base\main.css"
Remove-Item -Force "$base\App.vue"
Remove-Item -Force "$base\router.ts"
Remove-Item -Force "$base\env.d.ts"
Remove-Item -Force "$base\testws.vue"
```

- [ ] **Step 2: Run typecheck** — if any errors, an old file was still needed, restore it

- [ ] **Step 3: Commit**

### Task 20: Update import paths to final form

- [ ] **Step 1: Ensure all imports use `@/` alias paths (not relative `../../`)**

Search for `from '../` across all `modules/` and `shared/` files. Replace deep relative imports with `@/modules/xxx` or `@/shared/xxx`.

- [ ] **Step 2: Run final typecheck**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"; npm run typecheck
```

- [ ] **Step 3: Verify no imports reference old paths**

```powershell
Select-String -Path "D:\Qomo\QomoTech\QomoTech_FrontEnd\src\renderer\src" -Pattern "from.*api/core|from.*stores/(?!pinia)|from.*features/|from.*view/|from.*configs/" -Recurse
```
Expected: zero results

- [ ] **Step 4: Final commit**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_FrontEnd"
git add -A src/renderer/src/
git commit -m "refactor(phase4): delete old structure, finalize import paths"
```

---

## Task Summary

| Phase | Tasks | Est. time |
|-------|-------|-----------|
| Phase 1: Foundation | Tasks 1-7 | ~2 hours |
| Phase 2: Module migration | Tasks 8-15 | ~4 hours |
| Phase 3: Large file splits | Tasks 16-18 | ~3 hours |
| Phase 4: Cleanup | Tasks 19-20 | ~30 min |
| **Total** | **20 tasks** | **~10 hours** |
