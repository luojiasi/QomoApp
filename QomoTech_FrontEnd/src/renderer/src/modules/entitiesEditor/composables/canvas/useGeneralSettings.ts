import { reactive } from 'vue'
import { loadGeneralConfig } from '../../stores/generalSettingsStore'
import {
  DEFAULT_HEIGHT,
  DEFAULT_OPEN_SIZE,
  DEFAULT_TILT_ANGLE,
  PROJECT_DEFAULT_NAME,
} from '../../configs/defaults'
import type { GeneralEditorConfig } from '../../shares/types'

export interface GeneralSettingsForm {
  defaultProjectName: string
  defaultExtrudeHeight: number
  defaultOpenSize: number
  defaultTiltAngle: number
}

export function useGeneralSettings() {
  const initial = loadGeneralConfig()

  const form = reactive<GeneralSettingsForm>({
    defaultProjectName: initial.defaultProjectName,
    defaultExtrudeHeight: initial.defaultExtrudeHeight,
    defaultOpenSize: initial.defaultOpenSize,
    defaultTiltAngle: initial.defaultTiltAngle,
  })

  function reset() {
    form.defaultProjectName = PROJECT_DEFAULT_NAME
    form.defaultExtrudeHeight = DEFAULT_HEIGHT
    form.defaultOpenSize = DEFAULT_OPEN_SIZE
    form.defaultTiltAngle = DEFAULT_TILT_ANGLE
  }

  function toData(): GeneralEditorConfig {
    return {
      defaultProjectName: form.defaultProjectName,
      defaultExtrudeHeight: form.defaultExtrudeHeight,
      defaultOpenSize: form.defaultOpenSize,
      defaultTiltAngle: form.defaultTiltAngle,
    }
  }

  function reload() {
    const config = loadGeneralConfig()
    form.defaultProjectName = config.defaultProjectName
    form.defaultExtrudeHeight = config.defaultExtrudeHeight
    form.defaultOpenSize = config.defaultOpenSize
    form.defaultTiltAngle = config.defaultTiltAngle
  }

  return { form, reset, toData, reload }
}
