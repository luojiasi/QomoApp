import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useCameraSettingsStore } from '../stores/useCameraSettingsStore'
import {
  bootstrapCameraSettings,
  disconnectCamera,
  fetchCameraDevices,
  getCameraStatus,
  setCameraExposure,
  setCameraFrameSpeed,
  setCameraMirror,
  setCameraWhiteBalance
} from '../api'
import { initSdkEnumAndConnectIndex0 } from '../composables/useCameraControl'
import type { CameraDeviceInfo, CameraStatusPayload } from '../types'
import { clampInt, clampFloat } from '../utils'

export function useCameraSettingsPageLogic() {
  const { success, error } = useNotification()
  const cameraStore = useCameraSettingsStore()
  const { cameraSettings } = storeToRefs(cameraStore)

  const cameraDevices = ref<CameraDeviceInfo[]>([])
  const cameraStatus = ref<CameraStatusPayload | null>(null)
  const busy = ref(false)

  const isConnected = computed(() => Boolean(cameraStatus.value?.connected))
  const speedLabel = computed(() => {
    const level = Number(cameraSettings.value.frameSpeedLevel)
    if (level === 0) return 'HIGHEST_SPEED'
    if (level === 1) return 'HIGH_SPEED'
    if (level === 2) return 'LOW_SPEED'
    return 'LOWEST_SPEED'
  })

  function applyStatus(status: CameraStatusPayload): void {
    cameraStatus.value = status
    if (typeof status.selected_index === 'number') {
      cameraSettings.value.cameraIndex = status.selected_index
    }
  }

  async function loadDevices(): Promise<void> {
    const res = await fetchCameraDevices()
    if (res.success && Array.isArray(res.data?.devices)) {
      cameraDevices.value = res.data.devices
    } else if (!res.success) {
      error('获取相机列表失败', res.message ?? '')
    }
  }

  async function loadStatus(): Promise<void> {
    const res = await getCameraStatus()
    if (res.success && res.data) {
      applyStatus(res.data)
    }
  }

  async function handleConnect(): Promise<void> {
    busy.value = true
    try {
      await bootstrapCameraSettings({
        auto_exposure: Boolean(cameraSettings.value.autoExposure),
        exposure_time: clampInt(cameraSettings.value.exposureTime, 0, 65535, 1000),
        speed_level: cameraSettings.value.frameSpeedLevel,
        auto_tune: Boolean(cameraSettings.value.frameSpeedAutoTune),
        tune: clampFloat(cameraSettings.value.frameSpeedTune, 0, 1, 1),
        mirror_horizontal: Boolean(cameraSettings.value.mirrorHorizontal),
        mirror_vertical: Boolean(cameraSettings.value.mirrorVertical),
        auto_white_balance: Boolean(cameraSettings.value.autoWhiteBalance),
        r_gain: clampInt(cameraSettings.value.whiteBalanceRGain, 0, 65535, 21),
        g_gain: clampInt(cameraSettings.value.whiteBalanceGGain, 0, 65535, 22),
        b_gain: clampInt(cameraSettings.value.whiteBalanceBGain, 0, 65535, 16),
      })

      const res = await initSdkEnumAndConnectIndex0()
      if (!res.success || !res.data) {
        error('连接失败', res.message ?? '')
        return
      }
      cameraSettings.value.cameraIndex = 0
      applyStatus(res.data)
      success('相机连接成功', '引导参数已缓存，连接后自动下发')
    } finally {
      busy.value = false
    }
  }

  async function handleDisconnect(): Promise<void> {
    busy.value = true
    try {
      const res = await disconnectCamera()
      if (!res.success || !res.data) {
        error('断开失败', res.message ?? '')
        return
      }
      applyStatus(res.data)
      success('相机已断开')
    } finally {
      busy.value = false
    }
  }

  async function handleApplyExposure(): Promise<void> {
    busy.value = true
    try {
      const res = await setCameraExposure({
        auto_exposure: Boolean(cameraSettings.value.autoExposure),
        exposure_time: clampInt(cameraSettings.value.exposureTime, 0, 65535, 1000)
      })
      if (!res.success || !res.data) {
        error('曝光参数下发失败', res.message ?? '')
        return
      }
      applyStatus(res.data)
      success('曝光参数已应用')
    } finally {
      busy.value = false
    }
  }

  async function handleApplyFrameSpeed(): Promise<void> {
    busy.value = true
    try {
      const res = await setCameraFrameSpeed({
        speed_level: cameraSettings.value.frameSpeedLevel,
        auto_tune: Boolean(cameraSettings.value.frameSpeedAutoTune),
        tune: clampFloat(cameraSettings.value.frameSpeedTune, 0, 1, 1)
      })
      if (!res.success || !res.data) {
        error('帧率参数下发失败', res.message ?? '')
        return
      }
      applyStatus(res.data)
      success('帧率参数已应用')
    } finally {
      busy.value = false
    }
  }

  async function handleApplyMirror(): Promise<void> {
    busy.value = true
    try {
      const res = await setCameraMirror({
        horizontal: Boolean(cameraSettings.value.mirrorHorizontal),
        vertical: Boolean(cameraSettings.value.mirrorVertical)
      })
      if (!res.success || !res.data) {
        error('镜像参数下发失败', res.message ?? '')
        return
      }
      applyStatus(res.data)
      success('镜像参数已应用')
    } finally {
      busy.value = false
    }
  }

  async function handleApplyWhiteBalance(once = false): Promise<void> {
    busy.value = true
    try {
      const res = await setCameraWhiteBalance({
        auto_white_balance: Boolean(cameraSettings.value.autoWhiteBalance),
        once,
        r_gain: clampInt(cameraSettings.value.whiteBalanceRGain, 0, 65535, 21),
        g_gain: clampInt(cameraSettings.value.whiteBalanceGGain, 0, 65535, 22),
        b_gain: clampInt(cameraSettings.value.whiteBalanceBGain, 0, 65535, 16),
      })
      if (!res.success || !res.data) {
        error('白平衡参数下发失败', res.message ?? '')
        return
      }
      applyStatus(res.data)
      success('白平衡参数已应用')
    } finally {
      busy.value = false
    }
  }

  async function handleSaveSettings(): Promise<void> {
    await cameraStore.saveToServer()
    success('已保存', '相机参数已保存到服务端')
  }

  async function handleReset(): Promise<void> {
    await cameraStore.resetCameraSettings()
    success('已重置', '相机参数已恢复为默认值')
  }

  onMounted(async () => {
    await cameraStore.loadCameraSettings()
    await loadDevices()
    await loadStatus()
  })

  return {
    cameraStore,
    cameraSettings,
    cameraDevices,
    cameraStatus,
    busy,
    isConnected,
    speedLabel,
    handleConnect,
    handleDisconnect,
    handleApplyExposure,
    handleApplyFrameSpeed,
    handleApplyMirror,
    handleApplyWhiteBalance,
    handleSaveSettings,
    handleReset,
    loadDevices,
    loadStatus
  }
}
