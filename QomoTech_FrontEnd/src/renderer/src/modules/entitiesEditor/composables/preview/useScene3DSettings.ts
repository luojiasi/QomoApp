import { reactive } from 'vue'

import {
  CAMERA_INITIAL_POS,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  SCENE_BACKGROUND,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POS,
  AXES_SIZE,
  SHOW_GRID,
  SHOW_AXES,
  CONTROLS_MIN_DISTANCE,
  CONTROLS_MAX_DISTANCE,
  GRID_SIZE,
  GRID_DIVISIONS,
  GRID_COLOR_CENTER,
  GRID_COLOR_EDGE,
  MATERIAL_DEFAULT_COLOR,
  MATERIAL_SELECTED_COLOR,
  MATERIAL_WALL_TOP_COLOR,
  MATERIAL_WALL_BOTTOM_COLOR,
  MATERIAL_REFERENCE_OPACITY,
  MATERIAL_WALL_OPACITY,
  MATERIAL_SELECTED_WALL_OPACITY,
  MATERIAL_CAP_COLOR,
  MATERIAL_SELECTED_CAP_COLOR,
  MATERIAL_CAP_OPACITY,
  MATERIAL_SELECTED_CAP_OPACITY,
} from '../../configs/defaults'

export interface Scene3DForm {
  // 相机
  cameraX: number
  cameraY: number
  cameraZ: number
  cameraFov: number
  cameraNear: number
  cameraFar: number
  minDistance: number
  maxDistance: number
  // 背景
  bgColor: string
  // 光照
  ambientIntensity: number
  dirLightIntensity: number
  dirLightX: number
  dirLightY: number
  dirLightZ: number
  // 可见性
  showGrid: boolean
  showAxes: boolean
  // 坐标轴
  axesSize: number
  // 网格
  gridSize: number
  gridDivisions: number
  gridColorC: string
  gridColorE: string
  // 预览材质
  materialDefaultColor: string
  materialSelectedColor: string
  materialWallTopColor: string
  materialWallBottomColor: string
  materialReferenceOpacity: number
  materialWallOpacity: number
  materialSelectedWallOpacity: number
  materialCapColor: string
  materialSelectedCapColor: string
  materialCapOpacity: number
  materialSelectedCapOpacity: number
}

function hexOf(c: number): string {
  return '#' + c.toString(16).padStart(6, '0')
}

function numOf(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

export function useScene3DSettings() {
  const form = reactive<Scene3DForm>({
    cameraX: CAMERA_INITIAL_POS.x,
    cameraY: CAMERA_INITIAL_POS.y,
    cameraZ: CAMERA_INITIAL_POS.z,
    cameraFov: CAMERA_FOV,
    cameraNear: CAMERA_NEAR,
    cameraFar: CAMERA_FAR,
    minDistance: CONTROLS_MIN_DISTANCE,
    maxDistance: CONTROLS_MAX_DISTANCE,
    bgColor: hexOf(SCENE_BACKGROUND),
    ambientIntensity: AMBIENT_LIGHT_INTENSITY,
    dirLightIntensity: DIRECTIONAL_LIGHT_INTENSITY,
    dirLightX: DIRECTIONAL_LIGHT_POS.x,
    dirLightY: DIRECTIONAL_LIGHT_POS.y,
    dirLightZ: DIRECTIONAL_LIGHT_POS.z,
    axesSize: AXES_SIZE,
    gridSize: GRID_SIZE,
    gridDivisions: GRID_DIVISIONS,
    gridColorC: hexOf(GRID_COLOR_CENTER),
    gridColorE: hexOf(GRID_COLOR_EDGE),
    showGrid: SHOW_GRID,
    showAxes: SHOW_AXES,
    materialDefaultColor: hexOf(MATERIAL_DEFAULT_COLOR),
    materialSelectedColor: hexOf(MATERIAL_SELECTED_COLOR),
    materialWallTopColor: hexOf(MATERIAL_WALL_TOP_COLOR),
    materialWallBottomColor: hexOf(MATERIAL_WALL_BOTTOM_COLOR),
    materialReferenceOpacity: MATERIAL_REFERENCE_OPACITY,
    materialWallOpacity: MATERIAL_WALL_OPACITY,
    materialSelectedWallOpacity: MATERIAL_SELECTED_WALL_OPACITY,
    materialCapColor: hexOf(MATERIAL_CAP_COLOR),
    materialSelectedCapColor: hexOf(MATERIAL_SELECTED_CAP_COLOR),
    materialCapOpacity: MATERIAL_CAP_OPACITY,
    materialSelectedCapOpacity: MATERIAL_SELECTED_CAP_OPACITY,
  })

  function reset() {
    form.cameraX = CAMERA_INITIAL_POS.x
    form.cameraY = CAMERA_INITIAL_POS.y
    form.cameraZ = CAMERA_INITIAL_POS.z
    form.cameraFov = CAMERA_FOV
    form.cameraNear = CAMERA_NEAR
    form.cameraFar = CAMERA_FAR
    form.minDistance = CONTROLS_MIN_DISTANCE
    form.maxDistance = CONTROLS_MAX_DISTANCE
    form.bgColor = hexOf(SCENE_BACKGROUND)
    form.ambientIntensity = AMBIENT_LIGHT_INTENSITY
    form.dirLightIntensity = DIRECTIONAL_LIGHT_INTENSITY
    form.dirLightX = DIRECTIONAL_LIGHT_POS.x
    form.dirLightY = DIRECTIONAL_LIGHT_POS.y
    form.dirLightZ = DIRECTIONAL_LIGHT_POS.z
    form.showGrid = SHOW_GRID
    form.showAxes = SHOW_AXES
    form.axesSize = AXES_SIZE
    form.gridSize = GRID_SIZE
    form.gridDivisions = GRID_DIVISIONS
    form.gridColorC = hexOf(GRID_COLOR_CENTER)
    form.gridColorE = hexOf(GRID_COLOR_EDGE)
    form.materialDefaultColor = hexOf(MATERIAL_DEFAULT_COLOR)
    form.materialSelectedColor = hexOf(MATERIAL_SELECTED_COLOR)
    form.materialWallTopColor = hexOf(MATERIAL_WALL_TOP_COLOR)
    form.materialWallBottomColor = hexOf(MATERIAL_WALL_BOTTOM_COLOR)
    form.materialReferenceOpacity = MATERIAL_REFERENCE_OPACITY
    form.materialWallOpacity = MATERIAL_WALL_OPACITY
    form.materialSelectedWallOpacity = MATERIAL_SELECTED_WALL_OPACITY
    form.materialCapColor = hexOf(MATERIAL_CAP_COLOR)
    form.materialSelectedCapColor = hexOf(MATERIAL_SELECTED_CAP_COLOR)
    form.materialCapOpacity = MATERIAL_CAP_OPACITY
    form.materialSelectedCapOpacity = MATERIAL_SELECTED_CAP_OPACITY
  }

  /** 导出为可持久化的纯数据 */
  function toData() {
    return {
      cameraPosition: { x: form.cameraX, y: form.cameraY, z: form.cameraZ },
      cameraFov: form.cameraFov,
      cameraNear: form.cameraNear,
      cameraFar: form.cameraFar,
      sceneBackground: numOf(form.bgColor),
      ambientLightIntensity: form.ambientIntensity,
      directionalLightIntensity: form.dirLightIntensity,
      directionalLightPosition: { x: form.dirLightX, y: form.dirLightY, z: form.dirLightZ },
      axesSize: form.axesSize,
      gridSize: form.gridSize,
      gridDivisions: form.gridDivisions,
      gridColorCenter: numOf(form.gridColorC),
      gridColorEdge: numOf(form.gridColorE),
      showGrid: form.showGrid,
      showAxes: form.showAxes,
      controlsMinDistance: form.minDistance,
      controlsMaxDistance: form.maxDistance,
      materialDefaultColor: numOf(form.materialDefaultColor),
      materialSelectedColor: numOf(form.materialSelectedColor),
      materialWallTopColor: numOf(form.materialWallTopColor),
      materialWallBottomColor: numOf(form.materialWallBottomColor),
      materialReferenceOpacity: form.materialReferenceOpacity,
      materialWallOpacity: form.materialWallOpacity,
      materialSelectedWallOpacity: form.materialSelectedWallOpacity,
      materialCapColor: numOf(form.materialCapColor),
      materialSelectedCapColor: numOf(form.materialSelectedCapColor),
      materialCapOpacity: form.materialCapOpacity,
      materialSelectedCapOpacity: form.materialSelectedCapOpacity,
    }
  }

  return { form, reset, toData, hexOf, numOf }
}
