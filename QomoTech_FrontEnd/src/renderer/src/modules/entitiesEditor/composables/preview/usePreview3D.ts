import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  CAMERA_TARGET,
  RENDERER_ANTIALIAS,
  RENDERER_ALPHA,
  MAX_PIXEL_RATIO,
  CONTROLS_ENABLE_DAMPING,
  CONTROLS_DAMPING_FACTOR,
  CONTROLS_MIN_DISTANCE,
  CONTROLS_MAX_DISTANCE,
  AMBIENT_LIGHT_COLOR,
  DIRECTIONAL_LIGHT_COLOR,
  GRID_ROTATION_X,
} from '../../configs/defaults'
import { loadSceneConfig } from '../../stores/preview3dStore'
import type { Scene3DConfig } from '../../shares/types'
import { cameraDistance } from '../useStatusBar'

export function usePreview3D() {
  const containerRef = ref<HTMLDivElement | null>(null)

  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let animationId = 0
  let resizeObserver: ResizeObserver | null = null

  // scene objects that need updating on config change
  let ambientLight: THREE.AmbientLight | null = null
  let dirLight: THREE.DirectionalLight | null = null
  let axesHelper: THREE.AxesHelper | null = null
  let gridHelper: THREE.GridHelper | null = null

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
    if (camera && controls) {
      cameraDistance.value = camera.position.distanceTo(controls.target)
    }
    if (renderer && scene && camera) renderer.render(scene, camera)
  }

  function applyConfig(cfg: Scene3DConfig) {
    if (!scene || !camera) return

    scene.background = new THREE.Color(cfg.sceneBackground)

    camera.fov = cfg.cameraFov
    camera.near = cfg.cameraNear
    camera.far = cfg.cameraFar
    camera.position.set(cfg.cameraPosition.x, cfg.cameraPosition.y, cfg.cameraPosition.z)
    camera.updateProjectionMatrix()

    if (controls) {
      controls.minDistance = cfg.controlsMinDistance
      controls.maxDistance = cfg.controlsMaxDistance
    }

    if (ambientLight) {
      ambientLight.intensity = cfg.ambientLightIntensity
    }
    if (dirLight) {
      dirLight.intensity = cfg.directionalLightIntensity
      dirLight.position.set(cfg.directionalLightPosition.x, cfg.directionalLightPosition.y, cfg.directionalLightPosition.z)
    }
    if (axesHelper) {
      if (axesHelper.parent) axesHelper.parent.remove(axesHelper)
      axesHelper.dispose()
      axesHelper = null
    }
    if (cfg.showAxes) {
      axesHelper = new THREE.AxesHelper(cfg.axesSize)
      scene.add(axesHelper)
    }

    if (gridHelper) {
      if (gridHelper.parent) gridHelper.parent.remove(gridHelper)
      gridHelper.dispose()
      gridHelper = null
    }
    if (cfg.showGrid) {
      gridHelper = new THREE.GridHelper(cfg.gridSize, cfg.gridDivisions, cfg.gridColorCenter, cfg.gridColorEdge)
      gridHelper.rotation.x = GRID_ROTATION_X
      scene.add(gridHelper)
    }
  }

  onMounted(() => {
    if (!containerRef.value) return

    const cfg = loadSceneConfig()

    scene = new THREE.Scene()
    scene.background = new THREE.Color(cfg.sceneBackground)

    camera = new THREE.PerspectiveCamera(cfg.cameraFov, 1, cfg.cameraNear, cfg.cameraFar)
    camera.position.set(cfg.cameraPosition.x, cfg.cameraPosition.y, cfg.cameraPosition.z)
    camera.up.set(0, 0, 1)

    renderer = new THREE.WebGLRenderer({ antialias: RENDERER_ANTIALIAS, alpha: RENDERER_ALPHA })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    containerRef.value.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = CONTROLS_ENABLE_DAMPING
    controls.dampingFactor = CONTROLS_DAMPING_FACTOR
    controls.minDistance = cfg.controlsMinDistance ?? CONTROLS_MIN_DISTANCE
    controls.maxDistance = cfg.controlsMaxDistance ?? CONTROLS_MAX_DISTANCE
    controls.target.set(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)
    controls.update()

    ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, cfg.ambientLightIntensity)
    scene.add(ambientLight)
    dirLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, cfg.directionalLightIntensity)
    dirLight.position.set(cfg.directionalLightPosition.x, cfg.directionalLightPosition.y, cfg.directionalLightPosition.z)
    scene.add(dirLight)

    if (cfg.showAxes) {
      axesHelper = new THREE.AxesHelper(cfg.axesSize)
      scene.add(axesHelper)
    }
    if (cfg.showGrid) {
      gridHelper = new THREE.GridHelper(cfg.gridSize, cfg.gridDivisions, cfg.gridColorCenter, cfg.gridColorEdge)
      gridHelper.rotation.x = GRID_ROTATION_X
      scene.add(gridHelper)
    }

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

  /** 从 localStorage 重新读取配置并应用到场景 */
  function reloadConfig() {
    applyConfig(loadSceneConfig())
  }

  return { containerRef, reloadConfig, applyConfig }
}
