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
  GRID_SIZE,
  GRID_DIVISIONS,
  GRID_COLOR_CENTER,
  GRID_COLOR_EDGE,
} from '../../configs/defaults'

export interface Scene3DForm {
  // 相机
  cameraX: number
  cameraY: number
  cameraZ: number
  cameraFov: number
  cameraNear: number
  cameraFar: number
  // 背景
  bgColor: string // hex string for display
  // 光照
  ambientIntensity: number
  dirLightIntensity: number
  dirLightX: number
  dirLightY: number
  dirLightZ: number
  // 坐标轴
  axesSize: number
  // 网格
  gridSize: number
  gridDivisions: number
  gridColorC: string // hex string
  gridColorE: string // hex string
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
  })

  function reset() {
    form.cameraX = CAMERA_INITIAL_POS.x
    form.cameraY = CAMERA_INITIAL_POS.y
    form.cameraZ = CAMERA_INITIAL_POS.z
    form.cameraFov = CAMERA_FOV
    form.cameraNear = CAMERA_NEAR
    form.cameraFar = CAMERA_FAR
    form.bgColor = hexOf(SCENE_BACKGROUND)
    form.ambientIntensity = AMBIENT_LIGHT_INTENSITY
    form.dirLightIntensity = DIRECTIONAL_LIGHT_INTENSITY
    form.dirLightX = DIRECTIONAL_LIGHT_POS.x
    form.dirLightY = DIRECTIONAL_LIGHT_POS.y
    form.dirLightZ = DIRECTIONAL_LIGHT_POS.z
    form.axesSize = AXES_SIZE
    form.gridSize = GRID_SIZE
    form.gridDivisions = GRID_DIVISIONS
    form.gridColorC = hexOf(GRID_COLOR_CENTER)
    form.gridColorE = hexOf(GRID_COLOR_EDGE)
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
    }
  }

  return { form, reset, toData, hexOf, numOf }
}
