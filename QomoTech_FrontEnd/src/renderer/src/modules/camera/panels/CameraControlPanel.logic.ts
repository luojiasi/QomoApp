import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useCameraSettingsStore } from '../stores/useCameraSettingsStore'
import { bootstrapCameraSettings, disconnectCamera } from '../api'
import { initSdkEnumAndConnectIndex0 } from '../composables/useCameraControl'
import { clampInt, clampFloat, numericEqual } from '../utils'

export function useCameraControlPanelLogic() {
  const { success, error, info } = useNotification()
  const cameraStore = useCameraSettingsStore()
  const { cameraSettings } = storeToRefs(cameraStore)

  const isCameraPanelExpanded = ref(false)
  const applying = ref(false)
  const baselineLoaded = ref(false)

  const appliedBaselineAutoExposure = ref<boolean | null>(null)
  const appliedBaselineAutoWhiteBalance = ref<boolean | null>(null)
  const appliedBaselineExposureTime = ref<number | null>(null)
  const appliedBaselineFrameSpeedLevel = ref<number | null>(null)
  const appliedBaselineMirrorHorizontal = ref<boolean | null>(null)
  const appliedBaselineMirrorVertical = ref<boolean | null>(null)

  const hasPendingApplyChanges = computed(() => {
    if (!baselineLoaded.value) return false
    return (
      Boolean(cameraSettings.value.autoExposure) !== Boolean(appliedBaselineAutoExposure.value) ||
      Boolean(cameraSettings.value.autoWhiteBalance) !== Boolean(appliedBaselineAutoWhiteBalance.value) ||
      !numericEqual(Number(cameraSettings.value.exposureTime), appliedBaselineExposureTime.value) ||
      !numericEqual(Number(cameraSettings.value.frameSpeedLevel), appliedBaselineFrameSpeedLevel.value) ||
      Boolean(cameraSettings.value.mirrorHorizontal) !== Boolean(appliedBaselineMirrorHorizontal.value) ||
      Boolean(cameraSettings.value.mirrorVertical) !== Boolean(appliedBaselineMirrorVertical.value)
    )
  })

  function syncBaselineFromForm(): void {
    appliedBaselineAutoExposure.value = Boolean(cameraSettings.value.autoExposure)
    appliedBaselineAutoWhiteBalance.value = Boolean(cameraSettings.value.autoWhiteBalance)
    appliedBaselineExposureTime.value = Number(cameraSettings.value.exposureTime)
    appliedBaselineFrameSpeedLevel.value = Number(cameraSettings.value.frameSpeedLevel)
    appliedBaselineMirrorHorizontal.value = Boolean(cameraSettings.value.mirrorHorizontal)
    appliedBaselineMirrorVertical.value = Boolean(cameraSettings.value.mirrorVertical)
    baselineLoaded.value = true
  }

  onMounted(() => {
    syncBaselineFromForm()
  })

  async function handleApply(): Promise<void> {
    if (applying.value) return
    applying.value = true
    try {
      info('正在应用相机参数，请稍后...')

      // 1. 先断开，让相机进入 IDLE 状态
      const releaseRes = await disconnectCamera()
      if (!releaseRes.success) {
        error('应用失败', releaseRes.message ?? '释放相机失败')
        return
      }

      // 2. 在 IDLE 状态下缓存引导参数
      const bootstrapRes = await bootstrapCameraSettings({
        auto_exposure: Boolean(cameraSettings.value.autoExposure),
        exposure_time: clampInt(cameraSettings.value.exposureTime, 0, 65535, 1000),
        speed_level: cameraSettings.value.frameSpeedLevel,
        auto_tune: Boolean(cameraSettings.value.frameSpeedAutoTune),
        tune: Number(cameraSettings.value.frameSpeedTune),
        mirror_horizontal: Boolean(cameraSettings.value.mirrorHorizontal),
        mirror_vertical: Boolean(cameraSettings.value.mirrorVertical),
        auto_white_balance: Boolean(cameraSettings.value.autoWhiteBalance),
      })
      if (!bootstrapRes.success) {
        error('应用失败', bootstrapRes.message ?? '缓存引导参数失败')
        return
      }

      // 3. 重连，后端自动下发引导参数
      const reconnectRes = await initSdkEnumAndConnectIndex0()
      if (!reconnectRes.success) {
        error('应用失败', reconnectRes.message ?? '重连相机失败')
        return
      }
      cameraSettings.value.cameraIndex = 0

      syncBaselineFromForm()
      success('应用成功', '参数已缓存并在重连后自动下发')
    } finally {
      applying.value = false
    }
  }

  return {
    cameraSettings,
    isCameraPanelExpanded,
    applying,
    hasPendingApplyChanges,
    handleApply
  }
}
