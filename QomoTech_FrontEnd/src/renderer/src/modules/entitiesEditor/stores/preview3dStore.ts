// =============================================================================
// 3D 预览配置持久化 —— localStorage 读写，与 defaults.ts 默认值合并
// =============================================================================

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
  GRID_SIZE,
  GRID_DIVISIONS,
  GRID_COLOR_CENTER,
  GRID_COLOR_EDGE,
  STORAGE_KEY_SCENE3D,
} from '../configs/defaults'
import { Scene3DConfig } from '../shares/types'



export function loadSceneConfig(): Scene3DConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCENE3D)
    if (raw) {
      const saved = JSON.parse(raw)
      return {
        cameraPosition: saved.cameraPosition ?? { ...CAMERA_INITIAL_POS },
        cameraFov: saved.cameraFov ?? CAMERA_FOV,
        cameraNear: saved.cameraNear ?? CAMERA_NEAR,
        cameraFar: saved.cameraFar ?? CAMERA_FAR,
        sceneBackground: saved.sceneBackground ?? SCENE_BACKGROUND,
        ambientLightIntensity: saved.ambientLightIntensity ?? AMBIENT_LIGHT_INTENSITY,
        directionalLightIntensity: saved.directionalLightIntensity ?? DIRECTIONAL_LIGHT_INTENSITY,
        directionalLightPosition: saved.directionalLightPosition ?? { ...DIRECTIONAL_LIGHT_POS },
        axesSize: saved.axesSize ?? AXES_SIZE,
        gridSize: saved.gridSize ?? GRID_SIZE,
        gridDivisions: saved.gridDivisions ?? GRID_DIVISIONS,
        gridColorCenter: saved.gridColorCenter ?? GRID_COLOR_CENTER,
        gridColorEdge: saved.gridColorEdge ?? GRID_COLOR_EDGE,
        showGrid: saved.showGrid ?? SHOW_GRID,
        showAxes: saved.showAxes ?? SHOW_AXES,
      }
    }
  } catch { /* corrupted data, fall through to defaults */ }
  return {
    cameraPosition: { ...CAMERA_INITIAL_POS },
    cameraFov: CAMERA_FOV,
    cameraNear: CAMERA_NEAR,
    cameraFar: CAMERA_FAR,
    sceneBackground: SCENE_BACKGROUND,
    ambientLightIntensity: AMBIENT_LIGHT_INTENSITY,
    directionalLightIntensity: DIRECTIONAL_LIGHT_INTENSITY,
    directionalLightPosition: { ...DIRECTIONAL_LIGHT_POS },
    axesSize: AXES_SIZE,
    gridSize: GRID_SIZE,
    gridDivisions: GRID_DIVISIONS,
    gridColorCenter: GRID_COLOR_CENTER,
    gridColorEdge: GRID_COLOR_EDGE,
    showGrid: SHOW_GRID,
    showAxes: SHOW_AXES,
  }
}

export function saveSceneConfig(data: Scene3DConfig) {
  localStorage.setItem(STORAGE_KEY_SCENE3D, JSON.stringify(data))
}

