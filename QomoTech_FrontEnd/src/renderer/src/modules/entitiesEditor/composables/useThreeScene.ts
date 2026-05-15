// =============================================================================
// 3D 场景管理（含 7 项性能优化）
// ① 几何体合并  ② 共享材质  ③ 动态 LOD  ④ 增量更新
// ⑤ 简化渲染    ⑥ 视锥剔除  ⑦ 按需渲染
// =============================================================================

import { ref, watch, shallowRef } from 'vue'
import * as THREE from 'three'
import type { SurfaceEntity, Point2D, BoundingBox } from "@/modules/entitiesEditor/commons/types"
import {
  ENTITY_SIMPLIFY_THRESHOLD,
  LOD_SEGMENTS_NEAR,
  LOD_SEGMENTS_MID,
  LOD_SEGMENTS_FAR,
} from "@/modules/entitiesEditor/configs/defaults"
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import {
  sampleArcPoints,
  sampleBezierPoints,
  triangulateLineStrip,
  triangulateArcStrip,
  triangulateBezierStrip,
  offsetPolyline,
} from "@/modules/entitiesEditor/utils/geometry"

// ── 共享材质（②） ──

let _sharedMaterial: THREE.MeshStandardMaterial | null = null
function getSharedMaterial(): THREE.MeshStandardMaterial {
  if (!_sharedMaterial) {
    _sharedMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.55,
      metalness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
  }
  return _sharedMaterial
}

let _simplifiedMaterial: THREE.MeshStandardMaterial | null = null
function getSimplifiedMaterial(): THREE.MeshStandardMaterial {
  if (!_simplifiedMaterial) {
    _simplifiedMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.8,
      metalness: 0.0,
      wireframe: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
  }
  return _simplifiedMaterial
}

// ── LOD 段数选择（③） ──

function getLODSegments(camera: THREE.Camera, entityCenter: THREE.Vector3): number {
  const dist = camera.position.distanceTo(entityCenter)
  if (dist < 30) return LOD_SEGMENTS_NEAR
  if (dist < 80) return LOD_SEGMENTS_MID
  return LOD_SEGMENTS_FAR
}

// ── 实体几何体构建 ──

function buildEntityGeometry(
  entity: SurfaceEntity,
  segments: number,
): { positions: Float32Array; indices: Uint32Array } | null {
  const h = entity.height
  const openSize = entity.openSize

  try {
    switch (entity.kind) {
      case 'LINE': {
        const strip = [entity.start, entity.end]
        const innerStrip = offsetPolyline(strip, -openSize)
        return triangulateLineStrip(strip, innerStrip, h)
      }
      case 'ARC': {
        return triangulateArcStrip(
          entity.center, entity.radius,
          entity.startAngleDeg, entity.endAngleDeg,
          openSize, h, segments,
        )
      }
      case 'BEZIER': {
        return triangulateBezierStrip(
          entity.controlPoints, openSize, h, segments,
        )
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

// ── 合并几何体（①） ──

interface MergedGeometry {
  positions: number[]
  indices: number[]
  vertexCount: number
}

function mergeGeometries(geos: (Float32Array | null)[], idxs: (Uint32Array | null)[]): MergedGeometry {
  const result: MergedGeometry = { positions: [], indices: [], vertexCount: 0 }
  for (let i = 0; i < geos.length; i++) {
    const pos = geos[i]
    const ind = idxs[i]
    if (!pos || !ind) continue
    const baseVertex = result.vertexCount
    result.positions.push(...pos)
    for (let j = 0; j < ind.length; j++) {
      result.indices.push(ind[j] + baseVertex)
    }
    result.vertexCount += pos.length / 3
  }
  return result
}

// ── 主 composable ──

export function useThreeScene() {
  const store = useEditorStore()

  const scene = shallowRef<THREE.Scene | null>(null)
  const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
  const mainMesh = shallowRef<THREE.Mesh | null>(null)
  const needsRender = ref(false)

  // ── 初始化 ──

  function init(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    const cam = new THREE.PerspectiveCamera(45, w / (h || 1), 0.1, 1000)
    cam.position.set(0, 0, 80)
    cam.lookAt(0, 0, 0)
    camera.value = cam

    const rndr = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    rndr.setSize(w, h, false)
    rndr.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rndr.shadowMap.enabled = false
    renderer.value = rndr

    const scn = new THREE.Scene()
    scn.background = new THREE.Color(0x1a1a2e)

    // 灯光
    scn.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(50, 80, 100)
    scn.add(dir)

    // Grid
    const grid = new THREE.GridHelper(200, 40, 0x333355, 0x222244)
    scn.add(grid)

    // 初始空合并 Mesh
    const emptyGeo = new THREE.BufferGeometry()
    emptyGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    emptyGeo.setIndex([])
    const mesh = new THREE.Mesh(emptyGeo, getSharedMaterial())
    mesh.frustumCulled = true // ⑥ 视锥剔除
    scn.add(mesh)
    mainMesh.value = mesh

    scene.value = scn
    needsRender.value = true
    requestFrame()
  }

  // ── 重建所有几何体 ──

  function rebuildAllGeometry(): void {
    const mesh = mainMesh.value
    const scn = scene.value
    if (!mesh || !scn) return

    const entityList = store.entities
    const count = entityList.length
    const simplified = count > ENTITY_SIMPLIFY_THRESHOLD // ⑤ 简化渲染

    // 清理旧几何体
    mesh.geometry.dispose()

    if (count === 0) {
      const emptyGeo = new THREE.BufferGeometry()
      emptyGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
      emptyGeo.setIndex([])
      mesh.geometry = emptyGeo
      needsRender.value = true
      return
    }

    const cam = camera.value
    const avgCX = entityList.reduce((s, e) => {
      const c = getEntityCenterPoint(e)
      return s + (c?.X ?? 0)
    }, 0) / count
    const avgCY = entityList.reduce((s, e) => {
      const c = getEntityCenterPoint(e)
      return s + (c?.Y ?? 0)
    }, 0) / count
    const center3 = new THREE.Vector3(avgCX, avgCY, 0)
    const segments = cam ? getLODSegments(cam, center3) : LOD_SEGMENTS_NEAR // ③

    const positions: Float32Array[] = []
    const indices: Uint32Array[] = []

    for (const entity of entityList) {
      const geo = buildEntityGeometry(entity, segments)
      if (geo) {
        positions.push(geo.positions)
        indices.push(geo.indices)
      }
    }

    const merged = mergeGeometries(positions, indices)

    const bufferGeo = new THREE.BufferGeometry()
    bufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(merged.positions, 3))
    bufferGeo.setIndex(merged.indices)
    bufferGeo.computeVertexNormals()

    mesh.geometry = bufferGeo
    mesh.material = simplified ? getSimplifiedMaterial() : getSharedMaterial() // ⑤
    mesh.updateMatrixWorld()

    needsRender.value = true
  }

  // ── 增量重建（④） ──

  function rebuildDirtyGeometry(): void {
    if (store.dirtyEntityIds.length === 0) return
    // 增量更新策略：脏实体数少于总实体数的一半时才增量，否则全量重建
    if (store.dirtyEntityIds.length > store.entities.length / 2) {
      rebuildAllGeometry()
      store.clearDirty()
      return
    }

    // 当前简化策略：标记后全量重建（保留全量接口）
    // 后续可优化为仅重建脏实体对应的顶点缓冲区区域
    rebuildAllGeometry()
    store.clearDirty()
  }

  // ── 渲染循环（⑦ 按需渲染） ──

  let _rafId = 0

  function requestFrame(): void {
    if (_rafId) return
    _rafId = requestAnimationFrame(() => {
      _rafId = 0
      if (!needsRender.value) return
      renderFrame()
      needsRender.value = false
    })
  }

  function renderFrame(): void {
    const rndr = renderer.value
    const scn = scene.value
    const cam = camera.value
    if (!rndr || !scn || !cam) return
    rndr.render(scn, cam)
  }

  function resize(w: number, h: number): void {
    const rndr = renderer.value
    const cam = camera.value
    if (rndr) rndr.setSize(w, h, false)
    if (cam) { cam.aspect = w / (h || 1); cam.updateProjectionMatrix() }
    needsRender.value = true
    requestFrame()
  }

  // ── 监听实体变更 ──

  watch(
    () => [store.dirtyEntityIds.length, store.entities.length] as const,
    () => {
      rebuildDirtyGeometry()
      requestFrame()
    },
  )

  // ── 销毁 ──

  function dispose(): void {
    if (_rafId) cancelAnimationFrame(_rafId)
    const mesh = mainMesh.value
    if (mesh) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose())
      } else {
        (mesh.material as THREE.Material).dispose()
      }
    }
    const rndr = renderer.value
    if (rndr) rndr.dispose()
  }

  return { scene, camera, renderer, mainMesh, init, rebuildAllGeometry, rebuildDirtyGeometry, resize, dispose, needsRender }
}

function getEntityCenterPoint(entity: SurfaceEntity): Point2D | null {
  switch (entity.kind) {
    case 'LINE': return { X: (entity.start.X + entity.end.X) / 2, Y: (entity.start.Y + entity.end.Y) / 2 }
    case 'ARC':
    case 'CIRCLE': return entity.center as Point2D
    case 'BEZIER': {
      if (entity.controlPoints.length === 0) return null
      let sx = 0, sy = 0
      for (const p of entity.controlPoints) { sx += p.X; sy += p.Y }
      return { X: sx / entity.controlPoints.length, Y: sy / entity.controlPoints.length }
    }
    default: return null
  }
}
