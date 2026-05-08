# Qomo5P 偏移拼接讲解版（带示意图）

## 1. 使用目的

本文档用于团队讲解“开放实体偏移拼接”的计算路径，重点展示两种组合：

- `LINE - ARC`
- `ARC - BEZIER`

讲解目标：

1. 让大家理解为什么需要“端点求交覆盖”；
2. 让大家看懂每一步点是怎么来的；
3. 让大家能对照 `threeGeometry.ts` 快速定位代码。

---

## 2. 总体思路（一句话版）

每个实体先独立算出偏移点，然后在共享端点处取两边“偏移端点切线”做求交，把交点作为统一偏移端点（通过 miter 限制才生效）。

---

## 3. 通用流程图（适用于 LINE/ARC/BEZIER）

```text
[输入实体集合]
      |
      v
[筛选开放实体: LINE/ARC/BEZIER]
      |
      v
[为每个实体构建 profile]
  - originalPoints
  - offsetPoints
  - openSize
      |
      v
[遍历每个实体端点 start/end]
      |
      v
[找共享端点候选]
      |
      v
[构建两侧端点切线]
 current: from->to
 candidate: from->to
      |
      v
[2D 直线求交]
      |
      +-- 平行/无交点 --> [回退原偏移点]
      |
      v
[miter 距离检查]
      |
      +-- 超限 --> [回退原偏移点]
      |
      v
[写入 endpoint override]
      |
      v
[渲染阶段应用 override 覆盖首尾偏移点]
```

---

## 4. 场景 A：LINE - ARC 连接计算路径

## 4.1 几何示意（原始实体）

```text
           ARC
        .-'''''''-.
     .-'           '-.
   P*------------------->  LINE
   (共享端点)
```

`P` 是共享端点（line 的某端 + arc 的起点或终点）。

## 4.2 偏移后示意（目标）

```text
           ARC offset
        .-''''''''''-.
      .'
    I*===================> LINE offset
   (统一偏移端点)
```

`I` 是我们要求的交点（最终覆盖点）。

## 4.3 计算步骤拆解

### Step A1：构建 LINE 的偏移端点

输入：

- `L0 = (x0,y0)`，`L1 = (x1,y1)`，`openSize`

公式：

- `d = L1 - L0 = (dx,dy)`
- `n_right = (dy,-dx)/|d|`
- `n = n_right * sign`，`sign = RIGHT ? -1 : 1`
- `L0' = L0 + n*openSize`
- `L1' = L1 + n*openSize`

端点切线（如果共享端点在 line.start）：

- `lineOffsetTangent: from = L0'`, `to = L1'`

若共享端点在 line.end：

- `from = L1'`, `to = L0'`

### Step A2：构建 ARC 的偏移点序列

1. 算 `offsetRadius`（代码：`computeArcOffsetRadius`）；
2. 用 `createArcPoints(center, offsetRadius, startAngle, endAngle, segments)` 采样偏移弧；
3. 取共享端点侧的切线近似：
   - 若共享端点在 arc.start：`from = outerPts[0]`, `to = outerPts[1]`
   - 若共享端点在 arc.end：`from = outerPts[last]`, `to = outerPts[last-1]`

### Step A3：求交并筛选

两条直线：

- `A(t)=a0 + t*(a1-a0)`
- `B(u)=b0 + u*(b1-b0)`

求交：

- `det = cross(a1-a0, b1-b0)`
- `|det| < eps` -> 近平行，放弃
- 否则得到交点 `I`

miter 约束：

- `miterDistance = |I - baseOffsetEndpoint|`
- 若 `miterDistance > max(openSizeA, openSizeB) * MITER_LIMIT`，放弃

通过则：

- 把 `I` 写入该实体端点 override（`start` 或 `end`）

### Step A4：渲染覆盖

- `LINE`：用 `I` 覆盖 `offsetStart` 或 `offsetEnd`
- `ARC`：用 `I` 覆盖 `outerPts[0]` 或 `outerPts[last]`

这样两者偏移实体在节点处共点。

---

## 5. 场景 B：ARC - BEZIER 连接计算路径

## 5.1 几何示意（原始实体）

```text
           ARC
        .-'''''''-.
     .-'           P*~~~~~~~)~~~~~~~  BEZIER
   .'
```

`P` 是共享端点（arc 末端接 bezier 首端，或反过来）。

## 5.2 偏移后示意（目标）

```text
          ARC offset
       .-''''''''''-.
     .'
   I*~~~~~~~~~~~~~~~~~~~~~  BEZIER offset
```

## 5.3 计算步骤拆解

### Step B1：ARC 侧（与前面一致）

- `outerArcPts = createArcPoints(center, offsetRadius, ...)`
- 若端点在 start：切线 `outerArcPts[0] -> outerArcPts[1]`
- 若端点在 end：切线 `outerArcPts[last] -> outerArcPts[last-1]`

### Step B2：BEZIER 侧

1. `innerBezierPts = createBezierPoints(controlPoints, segments)`
2. `outerBezierPts = offsetOpenPolylineByOpenDirection(innerBezierPts, openDirection, openSize)`
3. 端点切线：
   - start：`outerBezierPts[0] -> outerBezierPts[1]`
   - end：`outerBezierPts[last] -> outerBezierPts[last-1]`

### Step B3：求交

对 ARC 端点切线与 BEZIER 端点切线执行同一个 `intersectLines2D(...)`。

### Step B4：筛选与覆盖

1. 通过 `MITER_LIMIT` 则采纳交点 `I`
2. 覆盖：
   - ARC 的 `outerPts` 端点
   - BEZIER 的 `outerPts` 端点

节点拼接完成。

---

## 6. 对照代码索引（便于现场讲解）

文件：`QomoTech_FrontEnd/src/renderer/src/utils/Qomo5P/threeGeometry.ts`

- profile 构建：`buildOpenEntityOffsetProfile`
- ARC 偏移半径：`computeArcOffsetRadius`
- 端点切线提取：`getOffsetEndpointLine`
- 共享点匹配：`isSamePoint`
- 2D 求交：`intersectLines2D`
- 端点 override 汇总：`buildOpenEntityOffsetOverrides`
- 渲染应用覆盖：`createEntityReferenceObject` 的 `LINE/ARC/BEZIER` 分支
- 主入口接入：`buildQomo5PSceneObjects`

---

## 7. 讲解建议（5 分钟版本）

1. 先讲“为什么断”：独立偏移端点不共点；
2. 再讲“怎么修”：端点切线求交；
3. 再讲“为什么稳”：平行回退 + miter 限制；
4. 用 `LINE-ARC` 图说明一次；
5. 用 `ARC-BEZIER` 图说明“跨类型也一样”。

---

## 8. 一页结论

- 这套机制不是改偏移规则，而是改“节点拼接规则”；
- 统一把 `LINE/ARC/BEZIER` 映射为端点切线求交问题；
- 通过 override 覆盖端点，达到跨类型连续连接；
- 异常场景自动回退，保证稳定性。

