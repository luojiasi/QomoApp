# 3D 预览最小场景实施计划

> 日期：2026-05-16  
> 目标：在 `entitiesEditor` 中基于 `Qomo3DPreview.vue` 核心骨架实现最小 3D 预览画面，不接入实体数据。

---

## 架构对应关系

```
Qomo3DPreview.vue（旧 editor）          →  entitiesEditor（新）
─────────────────────────────────────────────────────────────
硬编码的相机位置 120,-120,120           →  configs/defaults.ts（常量）
硬编码的背景色 #020617                  →  configs/defaults.ts（常量）
硬编码光照参数                          →  configs/defaults.ts（常量）
Scene/Camera/Renderer/Controls 初始化    →  composables/usePreview3D.ts
AxesHelper / GridHelper                 →  composables/usePreview3D.ts
渲染循环 + resize + 销毁                →  composables/usePreview3D.ts
容器 div + 挂载                         →  components/Preview3D.vue
页面集成                                →  pages/EditorPage.vue（已有，无需改）
```

---

## 实施步骤

| # | 文件 | 操作 | 行数 |
|---|------|------|:---:|
| 1 | `configs/defaults.ts` | 新增 3D 场景常量块 | +12 |
| 2 | `composables/usePreview3D.ts` | 替换空壳为完整 Three.js 逻辑 | ~80 |
| 3 | `components/Preview3D.vue` | 替换占位符为 canvas 容器 | ~20 |

---

## 步骤 1：`configs/defaults.ts`（追加 ~12 行）

在现有常量块末尾追加：

```ts
// ============ 3D 场景 ============

/** 相机初始位置 */
export const CAMERA_INITIAL_POS = { x: 120, y: -120, z: 120 } as const

/** 场景背景色 */
export const SCENE_BACKGROUND = 0x020617

/** 光照 */
export const AMBIENT_LIGHT_INTENSITY = 1.05
export const DIRECTIONAL_LIGHT_INTENSITY = 1.2
export const DIRECTIONAL_LIGHT_POS = { x: 100, y: 180, z: 120 } as const

/** 辅助元素 */
export const AXES_SIZE = 120
export const GRID_SIZE = 600
export const GRID_DIVISIONS = 60
```

---

## 步骤 2：`composables/usePreview3D.ts`（替换空壳，~80 行）

```ts
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  CAMERA_INITIAL_POS,
  SCENE_BACKGROUND,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POS,
  AXES_SIZE,
  GRID_SIZE,
  GRID_DIVISIONS,
} from '../configs/defaults'

export function usePreview3D() {
  const containerRef = ref<HTMLDivElement | null>(null)

  // ── 模块级变量（不需要响应式，避免 shallowRef 开销） ──
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let animationId = 0
  let resizeObserver: ResizeObserver | null = null

  function resize() {
    if (!containerRef.value || !renderer || !camera) return
    const w = Math.max(containerRef.value.clientWidth, 1)
    const h = Math.max(containerRef.value.clientHeight, 1)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function loop() {
    animationId = requestAnimationFrame(loop)
    controls?.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }

  onMounted(() => {
    if (!containerRef.value) return

    // 场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(SCENE_BACKGROUND)

    // 相机
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000)
    camera.position.set(CAMERA_INITIAL_POS.x, CAMERA_INITIAL_POS.y, CAMERA_INITIAL_POS.z)
    camera.up.set(0, 0, 1)

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.value.appendChild(renderer.domElement)

    // 控制器
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.update()

    // 光照
    scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY))
    const dir = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY)
    dir.position.set(DIRECTIONAL_LIGHT_POS.x, DIRECTIONAL_LIGHT_POS.y, DIRECTIONAL_LIGHT_POS.z)
    scene.add(dir)

    // 辅助元素
    scene.add(new THREE.AxesHelper(AXES_SIZE))
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x334155, 0x1e293b)
    grid.rotation.x = Math.PI / 2
    scene.add(grid)

    resize()
    loop()

    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(containerRef.value)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationId)
    resizeObserver?.disconnect()
    controls?.dispose()
    if (renderer) {
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  })

  return { containerRef }
}
```

---

## 步骤 3：`components/Preview3D.vue`（替换占位符，~20 行）

```vue
<script setup lang="ts">
import { usePreview3D } from '../composables/usePreview3D'
const { containerRef } = usePreview3D()
</script>

<template>
  <div ref="containerRef" class="preview-3d" />
</template>

<style scoped>
.preview-3d {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
```

---

## 文件归类总结

```
entitiesEditor/
│
├── configs/defaults.ts          ← +12 行：3D 常量块
├── composables/usePreview3D.ts  ← ~80 行：Three.js 核心
├── components/Preview3D.vue     ← ~20 行：canvas 容器
└── pages/EditorPage.vue         ← 已有 <Preview3D />，无需改
```

---

## 依赖确认

- `three`: `^0.183.2` ✅（已存在于 `package.json`）
- `three/examples/jsm/controls/OrbitControls.js`: 随 three 包附带 ✅

---

## 剥离清单（Qomo3DPreview.vue 中移除的模块）

| 模块 | 处理 | 原因 |
|------|:---:|------|
| `useQomo5PStore` + `storeToRefs` | ❌ | 不接入实体 |
| `visibleEntities` / `layers` computed | ❌ | 不接入实体 |
| `dynamicGroup` + `rebuildSceneObjects` | ❌ | 不接入实体 |
| `projectionGroup` + 投影逻辑 | ❌ | 不需要 |
| `fitCameraToScene` | ❌ | 空场景默认机位已足够 |
| `subscribeQomoTo5PAction` | ❌ | 不需要 |
| `watch([entities, ...])` | ❌ | 不接入实体 |
| `buildQomo5PSceneObjects` | ❌ | 不需要 |
| Scene + Camera + Renderer | ✅ | 核心保留 |
| OrbitControls | ✅ | 旋转/缩放 |
| AmbientLight + DirectionalLight | ✅ | 画面可见 |
| AxesHelper + GridHelper | ✅ | 方向参照 |
| ResizeObserver | ✅ | 自适应 |
| requestAnimationFrame 循环 | ✅ | 持续渲染 |
| 销毁逻辑 | ✅ | 防内存泄漏 |

---

## 预期效果

- 编辑器页面左侧出现深色 3D 视口（`#020617` 背景）
- 可见红色 X / 绿色 Y / 蓝色 Z 坐标轴（120 单位长）
- 可见 600×600 网格底面（深灰/更深灰交替）
- 鼠标可旋转（左键）、平移（右键）、缩放（滚轮）
- 窗口 resize 自适应
