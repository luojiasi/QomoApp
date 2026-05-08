# DXF 导入接入说明（Qomo5P）

本文档描述当前版本 DXF 导入的完整实现方案，包括：

- 导入入口与调用链
- `QomoDxf.ts` 各方法职责
- DXF 实体到现有 `QomoEntityWithSurface` 的映射规则
- 图层/元数据处理方式
- “剪裁相关对象”当前状态与后续方案

---

## 1. 目标与约束

当前项目的核心渲染与编辑数据结构是 `QomoEntityWithSurface`（`LINE/ARC/CIRCLE/IRREGULAR/BEZIER`）。
DXF 导入的目标不是新建一套渲染链，而是把 DXF 转成当前统一格式，保证：

1. 导入后可直接在 2D 画布显示
2. 导入后可直接进入 3D 预览链路
3. 图层信息可复用现有图层管理面板
4. 无法映射的实体不静默丢失，进入 `unsupportedEntities` 统计

---

## 2. 导入调用链（前端）

### 2.1 文件入口

文件：`src/renderer/src/view/Create5P.vue`

在 `handleImportFileChange` 中：

- `.ljs` -> `store.importProjectFromLjs(...)`
- `.dxf` -> `store.importProjectFromDxf(...)`

即：UI 层只识别文件类型与读取文本，具体解析交给 store + utils。

### 2.2 Store 入口

文件：`src/renderer/src/stores/qomo5pEditor.ts`

新增方法：`importProjectFromDxf(text, sourceFileName)`

职责：

1. 调用 `parseDxfToQomoEntities(text)` 生成 `{ layers, entities, unsupportedEntities }`
2. 执行实体规范化（复用已有 `normalizeEntity`）
3. 组装项目元数据（`sourceFileName/importedAt/entityCount/unsupportedEntities`）
4. 通过 `applySnapshot(..., true)` 一次性写入状态并重置历史

---

## 3. DXF 解析模块设计

文件：`src/renderer/src/utils/Qomo5P/QomoDxf.ts`

依赖：`dxf-parser`

核心导出：

- `parseDxfToQomoEntities(text: string): DxfImportResult`

返回结构：

- `layers: QomoLayer[]`
- `entities: QomoEntityWithSurface[]`
- `unsupportedEntities: number`

---

## 4. 方法级详细说明（QomoDxf.ts）

下面按职责拆解当前实现。

### 4.1 基础工具方法

#### `defaultWelding()`

为导入实体统一补齐焊接默认值，和手动画图时保持一致：

- `id: default-welding`
- `name: 默认焊接`
- `openAngle: 0.54`
- `openSize: 1`

#### `toNumber(value, fallback)`

安全转换数值，保证 `NaN/Infinity/undefined` 时回退默认值。

#### `toPoint(value)`

安全转换坐标对象到 `{x, y}`：

- 非对象、缺字段、非有限数时返回 `null`
- 防止坏数据进入实体构造

#### `toId(prefix, index)`

构造导入实体 id，避免与当前工程内实体冲突。

#### `toLayerName(entity)`

提取 DXF 图层名：

- 优先取 `entity.layer`
- 无效时回落到 `default`

---

### 4.2 图层处理方法

#### `buildLayerMap(entities)`

先扫描一遍 DXF 全体实体，生成“图层名 -> 图层信息”映射：

- 强制存在默认层：`id = 0, name = default`
- 其他层按首次出现顺序生成 `dxf-layer-n`
- 每层维护 `count`，后续用于统计

#### `buildEntityBase(entity, index, layerMap)`

为每个实体生成公共字段：

- `entityId`
- `layerId/layerName`
- 并给对应层 `count + 1`

这是所有实体转换函数共享的入口。

---

### 4.3 实体转换方法

#### `tryLineEntity(...)`

DXF `LINE` -> `QomoLineSurfacesEntity`

- 读取 `start/end`
- 写入 `type = LINE`
- 统一补齐表面参数（`baseHeight/extrudeHeight/surfaceAngle/welding`）

#### `tryCircleEntity(...)`

DXF `CIRCLE` -> `QomoCircleSurfacesEntity`

- 读取 `center/radius`
- `radius <= 1e-9` 直接判无效

#### `tryArcEntity(...)`

DXF `ARC` -> `QomoArcSurfacesEntity`

- 读取 `center/radius/startAngle/endAngle`
- 注意：`dxf-parser` 角度是弧度，内部转为角度（度）
- 同时反算 `startPoint/endPoint`，方便后续编辑与吸附逻辑直接复用

#### `tryEllipseEntity(...)`

DXF `ELLIPSE` -> `QomoIrregularSurfacesEntity(shape='oval')`

- 读取 `center/majorAxisEndPoint/axisRatio`
- `radiusX = |majorAxisEndPoint|`
- `radiusY = radiusX * axisRatio`
- `rotationDeg = atan2(majorAxisEndPoint.y, majorAxisEndPoint.x)`

这一步是“把 DXF 椭圆并入现有 IRREGULAR 椭圆格式”的关键。

#### `verticesToPoints(entity)`

提取 `vertices` 列表并过滤非法点。供 polyline 复用。

#### `tryPolylineEntities(...)`

DXF `LWPOLYLINE/POLYLINE` -> `QomoLineSurfacesEntity[]`

- 把连续顶点拆分为多段 `LINE`
- 若闭合（`shape===1` 或 `closed=true`）补最后一段（尾 -> 首）
- 跳过零长度段

这是为了最大兼容现有数据结构，不新增“多段线实体类型”。

#### `trySplineEntity(...)`

DXF `SPLINE` -> `QomoBezierSurfacesEntity`

- 读取 `controlPoints`
- 直接映射到 `points`
- 按系统上限截断至 6 点（与当前贝塞尔编辑器一致）

---

### 4.4 总控方法

#### `parseDxfToQomoEntities(text)`

流程：

1. `DxfParser.parseSync(text)`
2. 读取 `entities`
3. 先建 `layerMap`
4. 按实体类型分发到 `tryXxx` 转换
5. 失败或不支持则 `unsupportedEntities++`
6. 输出 `layers + entities + unsupportedEntities`

当前支持分支：

- `LINE`
- `CIRCLE`
- `ARC`
- `ELLIPSE`
- `LWPOLYLINE`
- `POLYLINE`
- `SPLINE`

---

## 5. DXF -> Qomo 字段映射规则

### 5.1 公共默认字段

导入实体统一赋值：

- `openDirection = RIGHT`
- `selected = false`
- `baseHeight = 60`
- `extrudeHeight = 5`
- `surfaceAngle = 0`
- `welding = defaultWelding()`

这样导入实体会和手工新建实体行为一致。

### 5.2 图层映射

- DXF 原始图层名保留到 `layerName`
- 映射后的层 id 由系统生成（`0` 或 `dxf-layer-n`）
- 导入后图层可直接在“图层管理”中编辑、开关显示、删除/迁移

### 5.3 元数据映射

在 `projectMeta` 中写入：

- `sourceFileName`
- `importedAt/updatedAt`
- `entityCount`
- `unsupportedEntities`

---

## 6. 关于“剪裁相关对象”的详细说明

你提到的“有剪裁的实体也要接进来”，这类 DXF 通常会出现：

- `INSERT + 块内图元 + XCLIP 边界`
- 图像/底图类对象上的裁剪边界
- 代理对象（不同 CAD 导出器定义差异很大）

### 6.1 当前实现状态

当前版本策略是：

1. 先保证主流几何实体可稳定导入显示
2. 对无法识别/无法转换的对象计入 `unsupportedEntities`
3. 不做“静默吞掉”，便于后续精准补齐

### 6.2 下一步推荐实现（剪裁完整支持）

建议按以下阶段推进：

1. **解析块引用展开**
   - 处理 `INSERT` 的平移/旋转/缩放
   - 把块内基础图元变换到世界坐标
2. **解析裁剪边界**
   - 识别裁剪多边形/矩形
   - 标准化成统一 clip polygon
3. **做几何裁切**
   - 线段：Cohen-Sutherland / Liang-Barsky / 多边形裁切
   - 圆弧：先参数切分再保留弧段
   - 闭合图形：多边形布尔裁剪
4. **回写实体**
   - 裁切结果继续映射到现有 `LINE/ARC/...`
   - 无法表达的结果计入 `unsupportedEntities`

---

## 7. 当前版本边界与注意事项

1. `SPLINE` 当前按控制点映射为 `BEZIER`，不是严格数学等价重建
2. `POLYLINE` 中含 bulge（弧段）时，当前按直线段拆分，尚未重建弧段
3. `ELLIPSE` 当前映射为完整椭圆（`IRREGULAR/oval`），未处理部分椭圆弧
4. 剪裁语义未完全实现，当前通过 `unsupportedEntities` 暴露差异

---

## 8. 结论

当前 DXF 接入已经完成“可用主链路”：

- 可以从 UI 直接导入 `.dxf`
- 可以进入现有 2D/3D 展示与编辑链
- 图层系统可复用
- 不支持部分有明确计数，便于后续逐类补齐（尤其是剪裁相关）

如果要做到“剪裁 100% 对齐”，下一阶段重点是：`INSERT/XCLIP` 展开 + 几何裁切。

