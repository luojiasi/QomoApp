# entitiesEditor 模块重构计划

> 日期：2026-05-15  
> 目标：在 `modules/entitiesEditor` 中创建全新模块，参照 `editor` 模块功能进行重构，重点优化 3D 渲染性能和架构分层。

---

## 一、设计动机

| 要点 | 旧版（editor） | 新版（entitiesEditor） |
|------|--------------|----------------------|
| Z 高度 | `baseHeight=60` + `extrudeHeight=5`，概念混淆 | **无默认 Z**，`height=5` 直接表示物体实际高度 |
| 3D 性能 | 每实体 4~8 个独立 Mesh，N×8 draw calls | **合并几何体 + 共享材质**，N×2 draw calls |
| 采样段数 | 硬编码 64/96 段 | LOD 自适应（近:64, 中:32, 远:16） |
| 重建策略 | 全量重建 | 增量更新 + dirty flag |
| 简化渲染 | 无 | 实体数 > 200 自动降级 |
| 架构分层 | Store 1162 行混杂一切 | Store(220行) → composable → component |
| 类型文件 | 2 个文件部分重复 | 单一 `commons/types.ts` |
| 快捷键 | 无 | `utils/shortcuts.ts` 集中管理 |

---

## 二、目标目录结构

```
entitiesEditor/
├── commons/
│   └── types.ts
├── configs/
│   └── defaults.ts
├── stores/
│   └── editorStore.ts
├── composables/
│   ├── useDxfImport.ts
│   ├── useLjsIO.ts
│   ├── useCanvasTool.ts
│   ├── useViewport.ts
│   ├── useThreeScene.ts          # ★ 含 7 项性能优化
│   └── useShortcuts.ts
├── utils/
│   ├── geometry.ts
│   ├── idgen.ts
│   └── shortcuts.ts
├── shares/
│   └── EntityTypeIcon.vue
├── components/
│   ├── EditorToolbar.vue
│   ├── Canvas2D.vue
│   ├── Preview3D.vue
│   ├── EntityInspector.vue
│   ├── LayerPanel.vue
│   └── StatusBar.vue
└── pages/
    └── EditorPage.vue
```

---

## 三、`commons/types.ts` 类型设计

### 3.1 排版规则

- 所有 `type` 别名（字面量联合、泛型组合）在前
- 所有 `interface` 定义在后
- 复用 `@/shared/types` 的 `XYZ` 作为 `Point3D`

### 3.2 type 别名清单

| 名称 | 值 | 说明 |
|------|-----|------|
| `EntityKind` | `'LINE' \| 'ARC' \| 'BEZIER'` | 核心三类型 |
| `ExtendedEntityKind` | `EntityKind \| 'CIRCLE' \| 'IRREGULAR' \| 'SPLINE'` | 拓展实体 |
| `OpenSide` | `'LEFT' \| 'RIGHT'` | 开口方向 |
| `IrregularVariant` | `'oval' \| 'heart' \| 'pear' \| 'square' \| 'marquise' \| 'cushion' \| 'octagon'` | 不规则形状 |
| `ToolMode` | `'SELECT' \| 'DRAW_LINE' \| 'DRAW_ARC' \| 'DRAW_BEZIER' \| 'PAN'` | 工具模式 |
| `ArcDrawMethod` | `'THREE_POINT' \| 'CENTER_RADIUS_ANGLE' \| 'CENTER_START_END'` | 弧线绘制 |
| `EditorAction` | 10 种子类型联合 | 统一事件总线 |
| `Point3D` | `XYZ` | 从 shared 导入 |
| `EditorEntity` | `LineEntity \| ArcEntity \| BezierEntity` | 基础联合 |
| `ExtendedEntity` | `EditorEntity \| CircleEntity \| IrregularEntity` | 拓展联合 |
| `SurfaceEntity<T>` | `T & ExtrusionParams` | 泛型附加挤出参数 |

**`EditorAction` 子类型：**

| 动作 | 携带数据 |
|------|---------|
| `UNDO` | — |
| `REDO` | — |
| `DELETE_SELECTED` | — |
| `SAVE` | `projectName` |
| `IMPORT_DXF` | `rawText, fileName` |
| `IMPORT_LJS` | `rawText, fileName` |
| `EXPORT_LJS` | `projectName` |
| `FOCUS_ENTITY` | `entityId` |
| `FIT_VIEW` | — |
| `SET_TOOL` | `tool` |

### 3.3 interface 清单

| 名称 | 关键字段 |
|------|---------|
| `Point2D` | `x, y` |
| `BoundingBox` | `minX, minY, maxX, maxY` |
| `ViewportState` | `zoom, panX, panY, width, height` |
| `SelectionRect` | `x, y, width, height` |
| `EditorLayer` | `id, name, visible, locked, entityCount` |
| `ProjectMeta` | `version, name, createdAt, updatedAt, sourceFileName, entityCount, unsupportedCount` |
| `ShortcutBinding` | `key, ctrl?, shift?, alt?, action, label` |
| `BaseEntity` | `id, kind, layerId, openSide, selected` |
| `LineEntity` | 继承 BaseEntity, `start, end` |
| `ArcEntity` | 继承 BaseEntity, `center, radius, startAngleDeg, endAngleDeg` |
| `BezierEntity` | 继承 BaseEntity, `controlPoints[]` |
| `CircleEntity` | 继承 BaseEntity, `center, radius` |
| `IrregularEntity` | 继承 BaseEntity, `variant, center, radiusX, radiusY, rotationDeg` |
| `ExtrusionParams` | `height, tiltAngleDeg, openSize` |
| `SerializedProject` | `format, version, savedAt, data` |
| `ProjectData` | `meta, layers, entities` |

### 3.4 关键变更：Z 高度模型

```
旧版：baseHeight=60 + extrudeHeight=5 分离
新版：height=5 直接表示物体高度，底面 Z=0，顶面 Z=height
```

---

## 四、`configs/defaults.ts`（~80行）

| 名称 | 值 | 说明 |
|------|-----|------|
| `PROJECT_VERSION` | `'2.0.0'` | 与旧版隔离 |
| `DEFAULT_HEIGHT` | `5` | ★ 物体实际高度 |
| `DEFAULT_OPEN_SIZE` | `1` | |
| `DEFAULT_TILT_ANGLE` | `0` | |
| `MIN_ZOOM` / `MAX_ZOOM` | `0.1` / `100` | |
| `MAX_UNDO_STEPS` | `50` | |
| `MAX_BEZIER_POINTS` | `128` | |
| `ENTITY_SIMPLIFY_THRESHOLD` | `200` | ★ 简化渲染阈值 |
| `LOD_SEGMENTS_NEAR` / `MID` / `FAR` | `64` / `32` / `16` | ★ LOD 段数 |
| `createDefaultExtrusion()` | 工厂函数 | |
| `createDefaultLayer()` | 工厂函数 | |
| `createDefaultViewport(w?, h?)` | 工厂函数 | |
| `createEmptyMeta(name?)` | 工厂函数 | |

---

## 五、`utils/geometry.ts` 纯几何工具（~180行）

| 分类 | 函数 | 说明 |
|------|------|------|
| 坐标 | `polarToCartesian`, `cartesianToPolar`, `midpoint`, `distance` | 基础转换 |
| 边界 | `boundsFromPoints`, `mergeBounds`, `getEntityBounds`, `getSceneBounds` | 边界计算 |
| 变换 | `translateEntity<T>`, `recenterEntities`, `projectToCircle` | 泛型平移 |
| 采样 | `sampleArcPoints(segments)`, `sampleBezierPoints(segments)` | ★ LOD 参数由调用方传入 |
| 偏移 | `offsetSegment`, `offsetPolyline` | 法向偏移 |
| 三角剖分 | `triangulateLineStrip`, `triangulateArcStrip`, `triangulateBezierStrip` | ★ 供 3D 合并几何体用 |

---

## 六、`stores/editorStore.ts`（~220行）

### State

| 变量 | 类型 | 说明 |
|------|------|------|
| `viewport` | `ViewportState` | |
| `layers` | `EditorLayer[]` | |
| `entities` | `SurfaceEntity[]` | 核心数据 |
| `selectedIds` | `string[]` | |
| `activeTool` | `ToolMode` | |
| `projectMeta` | `ProjectMeta` | |
| `undoStack` | `string[]` | JSON 快照 |
| `redoStack` | `string[]` | |
| `dirtyEntityIds` | `Set<string>` | ★ 脏标记 |

### Actions（16 个）

| 方法 | 说明 |
|------|------|
| `captureSnapshot()` / `applySnapshot(json)` | 快照捕获/恢复 |
| `undo()` / `redo()` | 撤销/重做 |
| `setTool(tool)` / `setSelection(ids)` | 工具/选中 |
| `addEntity(entity)` / `updateEntity(id, patch)` / `deleteSelected()` | 实体增删改 |
| `replaceAllEntities(entities)` | 导入批量替换 |
| `createLayer()` / `deleteLayer(id)` / `updateLayer(id, patch)` | 图层管理 |
| `setViewportSize(w, h)` / `resetViewport()` | 视口 |
| `applyMutation(mutator)` | ★ 统一变更入口 |

---

## 七、`composables/` 设计

### 7.1 `useDxfImport.ts`（~180行）

支持 LINE → ARC → CIRCLE → ELLIPSE(→oval) → POLYLINE → SPLINE(→bezier)  
常量全部从 configs 导入，ID 生成从 utils/idgen 导入。

### 7.2 `useViewport.ts`（~80行）

`{ worldToScreen, screenToWorld, zoomAt, fitToBounds, panBy }`

### 7.3 `useCanvasTool.ts`（~220行）

状态：`isDrawing, drawPreview, hoveredId, selectionRect`  
方法：`onMouseDown(e), onMouseMove(e), onMouseUp(e), onKeyDown(e)`  
根据 `activeTool` 分发绘图/选择/框选/平移子流程。

### 7.4 `useThreeScene.ts`（★ ~250行，含 7 项优化）

#### 优化明细

| # | 优化 | 原理 | 效果 |
|---|------|------|------|
| ① | 几何体合并 | 所有实体三角形拼入单一 BufferGeometry | N×8 → 2 draw calls |
| ② | 共享材质 | 全局单例 MeshStandardMaterial | 无重复材质创建 |
| ③ | 动态 LOD | `getLODSegments(cameraDistance)` | 近 64/中 32/远 16 |
| ④ | 增量更新 | dirtyEntityIds 驱动局部重建 | 不重建未变实体 |
| ⑤ | 简化渲染 | 超阈值降为线框+无桥接 | 大量实体帧率保底 |
| ⑥ | 视锥剔除 | BoundingSphere + FrustumCulling | Three.js 内置 |
| ⑦ | 按需渲染 | needsRender flag 控制 | 无变更不渲染 |

#### 性能对比

| 场景 | 旧版 draw calls | 新版 draw calls | 优化倍数 |
|------|----------------|----------------|----------|
| 10 LINE | ~80 | ~4 | **20x** |
| 100 LINE | ~800 | ~6 | **133x** |
| 500 实体 | ~4000 | ~8 | **500x** |
| 1000 实体 | ~8000 | ~10 | **800x** |

### 7.5 `useShortcuts.ts`（~30行）

从 `utils/shortcuts.ts` 读取定义，匹配按键后 dispatch EditorAction。

---

## 八、组件设计

| 组件 | 行数 | composable |
|------|------|-----------|
| `EditorToolbar.vue` | ~60 | useShortcuts |
| `Canvas2D.vue` | ~140 | useCanvasTool, useViewport |
| `Preview3D.vue` | ~40 | useThreeScene |
| `EntityInspector.vue` | ~80 | 直接读写 store |
| `LayerPanel.vue` | ~60 | 直接读写 store |
| `StatusBar.vue` | ~30 | store computed |

---

## 九、`pages/EditorPage.vue`（~70行）

纯排版：`EditorToolbar` + 左右分屏（`Canvas2D` | `Preview3D`）+ `LayerPanel` + `EntityInspector` + `StatusBar`

---

## 十、实施顺序（15步）

| # | 文件 | 行数 | 依赖 |
|---|------|------|------|
| 1 | `commons/types.ts` | 230 | 无 |
| 2 | `configs/defaults.ts` | 80 | types |
| 3 | `utils/idgen.ts` | 15 | 无 |
| 4 | `utils/geometry.ts` | 180 | types |
| 5 | `utils/shortcuts.ts` | 60 | types |
| 6 | `stores/editorStore.ts` | 220 | types, configs |
| 7 | `composables/useViewport.ts` | 80 | store, configs |
| 8 | `composables/useDxfImport.ts` | 180 | types, configs, utils |
| 9 | `composables/useLjsIO.ts` | 50 | types, configs |
| 10 | `composables/useCanvasTool.ts` | 220 | store, useViewport, utils |
| 11 | `composables/useThreeScene.ts` | 250 | store, utils |
| 12 | `composables/useShortcuts.ts` | 30 | store, utils/shortcuts |
| 13 | 6 个 `components/*.vue` | ~410 | 以上全部 |
| 14 | `shares/EntityTypeIcon.vue` | 25 | 无 |
| 15 | `pages/EditorPage.vue` | 70 | 全部组件 |

---

## 十一、复用清单

| 来源 | 内容 | 用途 |
|------|------|------|
| `@/shared/types` | `XYZ` | Point3D |
| `@/shared/composables/useNotification` | 通知提示 | 错误/成功 |
| `@/shared/composables/useGlobalKeyboard` | 模式参考 | 快捷键 |
| `@/shared/constants/storageKeys` | 新增 `QOMO5P_DRAFT_V2` | 草稿隔离 |
| `dxf-parser` (npm) | DXF 解析库 | 导入 |
| `three` (npm) | 3D 引擎 | 预览 |

---

## 十二、验证清单

- [ ] TypeScript 类型检查通过
- [ ] LINE / ARC / BEZIER 创建并正确显示在 2D 画布
- [ ] 3D 预览正确渲染，高度可独立设置
- [ ] DXF 导入 6 种图元全部正确
- [ ] .ljs 保存/加载（版本 2.0.0）
- [ ] 撤销/重做正常
- [ ] 快捷键全部生效
- [ ] 100+ 实体时 3D 帧率 ≥ 30fps
- [ ] 500+ 实体时自动启用简化渲染
- [ ] 旧版 1.0.0 .ljs 导入时提示升级
