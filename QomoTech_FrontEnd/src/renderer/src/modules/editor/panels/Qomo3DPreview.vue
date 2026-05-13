<template>
  <div class="h-full w-full">
    <div
      ref="containerRef"
      class="relative h-full w-full overflow-hidden rounded-2xl bg-slate-900/95"
    >
    <div
      v-if="visibleEntities.length === 0"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/55 text-center text-sm text-slate-200"
      >
        <div>
          <div class="text-lg font-semibold">左侧绘制平面图形后，这里会自动生成 3D 预览</div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { useQomo5PStore } from '@/stores/qomo5pEditor'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildQomo5PProjectionToZ0Objects, buildQomo5PSceneObjects, disposeThreeObject } from '@renderer/utils/Qomo5P/threeGeometry'
import { subscribeQomoTo5PAction } from '@renderer/utils/Qomo5P/QomoTo5P'

const store = useQomo5PStore()
const { entities, layers, selectedEntityIds } = storeToRefs(store)

const visibleLayerIdSet = computed(() => new Set(layers.value.filter((l) => l.visible).map((l) => l.id)))
const visibleEntities = computed(() => entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId)))

const containerRef = ref<HTMLDivElement | null>(null)
const resizeObserver = ref<ResizeObserver | null>(null)


let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let dynamicGroup: THREE.Group | null = null


// 展示投影的Group对象
let projectionGroup: THREE.Group | null = null
let isProjectionVisible = false
// 展示投影的Group对象



let axesHelper: THREE.Object3D | null = null
let gridHelper: THREE.Object3D | null = null
let animationFrameId = 0

// 取消订阅动作,避免内存泄漏
let unsubscribeAction: (() => void) | null = null

/** 适应视图时视角相对场景中心的观察方向（与空场景默认机位一致） */
const FIT_CAMERA_OFFSET_DIR = new THREE.Vector3(120, -120, 120).normalize()

const resizeRenderer = () => {
    if(!containerRef.value || !renderer || !camera) return
    const width = Math.max(containerRef.value.clientWidth, 1)
    const height = Math.max(containerRef.value.clientHeight, 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
}
const rebuildSceneObjects = () => {
    if(!dynamicGroup) return
    clearDynamicObjects()
    const objects = buildQomo5PSceneObjects(visibleEntities.value, selectedEntityIds.value)
    objects.forEach((object)=>dynamicGroup?.add(object))
    fitCameraToScene()
}


// 展示投影的Group对象=================================================
// 清除投影的Group对象
const clearProjectionObjects = () => {
    if(!projectionGroup) return
    const children = [...projectionGroup.children]
    children.forEach((child)=>{
        projectionGroup?.remove(child)
        disposeThreeObject(child)
    })
}

// 重建投影的Group对象
const rebuildProjectionObjects = () => {
    if(!projectionGroup || !isProjectionVisible) return
    clearProjectionObjects()
    const objects = buildQomo5PProjectionToZ0Objects(visibleEntities.value, selectedEntityIds.value)
    objects.forEach((object)=>projectionGroup?.add(object))
}

// 展示投影的Group对象================================================


//递归释放资源mesh、line、sprite
const clearDynamicObjects = () => {
    if(!dynamicGroup) return
    const children = [...dynamicGroup.children]
    children.forEach((child)=>{
        dynamicGroup?.remove(child)
        disposeThreeObject(child)
    })
}

const fitCameraToScene =()=>{
    if (!camera || !controls || !dynamicGroup) return
    const box = new THREE.Box3().setFromObject(dynamicGroup)
    if (box.isEmpty()) {
        controls.target.set(0, 0, 0)
        camera.up.set(0, 0, 1)
        // 与 FIT_CAMERA_OFFSET_DIR 同向，模长 = |(120,-120,120)| = 120√3
        camera.position.copy(FIT_CAMERA_OFFSET_DIR).multiplyScalar(120 * Math.sqrt(3))
        camera.lookAt(0, 0, 0)
        controls.update()
        return
    }
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 20)
    const distance = maxDimension * 1.7
    controls.target.copy(center)
    camera.up.set(0, 0, 1)
    camera.position.copy(center).add(FIT_CAMERA_OFFSET_DIR.clone().multiplyScalar(distance))
    camera.near = Math.max(distance / 1000, 0.1)
    camera.far = Math.max(distance * 20, 2000)
    camera.updateProjectionMatrix()
    controls.update()
}
const renderLoop = () => {
    animationFrameId = window.requestAnimationFrame(renderLoop)
    controls?.update()
    renderer?.render(scene as THREE.Scene, camera as THREE.Camera)
}

onMounted(() => {
    if(!containerRef.value) return
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000)
    camera.position.set(120, -120, 120)
    camera.up.set(0,0,1)
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.value.appendChild(renderer.domElement)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.update()
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(100, 180, 120)
    scene.add(directionalLight)
    axesHelper = new THREE.AxesHelper(120)
    scene.add(axesHelper)

    
    gridHelper = new THREE.GridHelper(600, 60, 0x334155, 0x1e293b)
    gridHelper.rotation.x = Math.PI / 2
    scene.add(gridHelper)


    dynamicGroup = new THREE.Group()
    scene.add(dynamicGroup)

    // 展示投影的Group对象=================================================
    projectionGroup = new THREE.Group()
    projectionGroup.visible = false
    scene.add(projectionGroup)
    // 展示投影的Group对象================================================

    resizeRenderer()
    rebuildSceneObjects()
    renderLoop()

    resizeObserver.value = new ResizeObserver(() => {
        resizeRenderer()
    })
    resizeObserver.value.observe(containerRef.value)

    // ========================================================
    // 订阅父组件按钮派发的交互动作
    unsubscribeAction = subscribeQomoTo5PAction((action) => {
        if (action.type === 'FIT_VIEW') {
            console.log('FIT_VIEW')
            fitCameraToScene()
            return
        }
        if (action.type === 'TOGGLE_GRID') {
            if (!gridHelper) return
            gridHelper.visible = !gridHelper.visible
            return
        }
        if (action.type === 'TOGGLE_AXES') {
            if (!axesHelper) return
            axesHelper.visible = !axesHelper.visible
            return
        }
        if (action.type === 'TOGGLE_PROJECTION_Z0') {
            isProjectionVisible = !isProjectionVisible
            if(!projectionGroup) return
            projectionGroup.visible = isProjectionVisible
            if (isProjectionVisible) rebuildProjectionObjects()
            return
        }
    })
    // ========================================================
})

watch([visibleEntities, selectedEntityIds], () => {
    rebuildSceneObjects()
    // 展示投影的Group对象
    if (isProjectionVisible) rebuildProjectionObjects()
    // 展示投影的Group对象
}, { deep: true })

onBeforeUnmount(()=>{
    window.cancelAnimationFrame(animationFrameId)
    resizeObserver.value?.disconnect()
    clearDynamicObjects()
    // 展示投影的Group对象
    clearProjectionObjects()
    // 展示投影的Group对象
    controls?.dispose()
    renderer?.dispose()
    if (renderer?.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    scene = null
    camera = null
    controls = null
    renderer = null
    dynamicGroup = null

    // ====================卸载组件资源=============================
    unsubscribeAction?.()
    unsubscribeAction = null
    // ========================================================
})
</script>