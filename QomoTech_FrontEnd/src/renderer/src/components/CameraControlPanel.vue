<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'
import { useNotification } from '../composables/useNotification'
import { useCameraSettingsStore } from '../stores/cameraSettingsStore'
import {
  disconnectCamera,
  initSdkEnumAndConnectIndex0,
  setCameraExposure,
  setCameraFrameSpeed,
  setCameraWhiteBalance
} from '../utils/cameraApi'

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

const EPS = 1e-6
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

const numericEqual = (a: number | null, b: number | null): boolean => {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) < EPS
}

const hasPendingApplyChanges = computed(() => {
  if (!baselineLoaded.value) return false
  return (
    Boolean(cameraSettings.value.autoExposure) !== Boolean(appliedBaselineAutoExposure.value) ||
    Boolean(cameraSettings.value.autoWhiteBalance) !== Boolean(appliedBaselineAutoWhiteBalance.value) ||
    !numericEqual(Number(cameraSettings.value.exposureTime), appliedBaselineExposureTime.value) ||
    !numericEqual(Number(cameraSettings.value.frameSpeedLevel), appliedBaselineFrameSpeedLevel.value)
  )
})

function syncBaselineFromForm(): void {
  appliedBaselineAutoExposure.value = Boolean(cameraSettings.value.autoExposure)
  appliedBaselineAutoWhiteBalance.value = Boolean(cameraSettings.value.autoWhiteBalance)
  appliedBaselineExposureTime.value = Number(cameraSettings.value.exposureTime)
  appliedBaselineFrameSpeedLevel.value = Number(cameraSettings.value.frameSpeedLevel)
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

    // 与 CameraSettings.vue 一致：应用参数前释放并重连，避免驱动不刷新的情况
    const releaseRes = await disconnectCamera()
    if (!releaseRes.success) {
      error('应用失败', releaseRes.message ?? '释放相机失败')
      return
    }

    const reconnectRes = await initSdkEnumAndConnectIndex0()
    if (!reconnectRes.success) {
      error('应用失败', reconnectRes.message ?? '重连相机失败')
      return
    }
    cameraSettings.value.cameraIndex = 0

    const resExposure = await setCameraExposure({
      auto_exposure: Boolean(cameraSettings.value.autoExposure),
      exposure_time: clampInt(cameraSettings.value.exposureTime, 0, 65535, 1000)
    })
    if (!resExposure.success) {
      error('应用失败', resExposure.message ?? '曝光参数下发失败')
      return
    }

    const resFrameSpeed = await setCameraFrameSpeed({
      speed_level: cameraSettings.value.frameSpeedLevel,
      auto_tune: Boolean(cameraSettings.value.frameSpeedAutoTune),
      tune: Number(cameraSettings.value.frameSpeedTune)
    })
    if (!resFrameSpeed.success) {
      error('应用失败', resFrameSpeed.message ?? '帧率参数下发失败')
      return
    }

    const resWb = await setCameraWhiteBalance({
      auto_white_balance: Boolean(cameraSettings.value.autoWhiteBalance)
    })
    if (!resWb.success) {
      error('应用失败', resWb.message ?? '白平衡参数下发失败')
      return
    }

    syncBaselineFromForm()
    success('应用成功', '相机参数已应用（已释放并重连）')
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isCameraPanelExpanded ? 'min-h-[min(180px,40vh)]' : ''"
  >
    <CollapsiblePanelHeader v-model:expanded="isCameraPanelExpanded" title="相机参数面板" />

    <div v-show="isCameraPanelExpanded" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div class="grid grid-cols-3 gap-3">
          <label class="col-span-1 flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">帧率档位</span>
            <input
              v-model.number="cameraSettings.frameSpeedLevel"
              type="number"
              min="0"
              max="3"
              step="1"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
            />
          </label>

          <label class="col-span-1 flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">曝光时间</span>
            <input
              v-model.number="cameraSettings.exposureTime"
              type="number"
              min="0"
              step="1"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
            />
          </label>

          <label class="col-span-1 flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">自动曝光</span>
            <select
              v-model="cameraSettings.autoExposure"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
            >
              <option :value="true">开启</option>
              <option :value="false">关闭</option>
            </select>
          </label>

          <label class="col-span-3 flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">自动白平衡</span>
            <select
              v-model="cameraSettings.autoWhiteBalance"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
            >
              <option :value="true">开启</option>
              <option :value="false">关闭</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="mt-4 flex w-full gap-3">
      <button
        v-if="hasPendingApplyChanges"
        type="button"
        class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-sm font-medium text-emerald-100/95 transition hover:bg-emerald-950/55 disabled:opacity-50"
        :disabled="applying"
        @click="handleApply"
      >
        {{ applying ? '应用中...' : '应用' }}
      </button>
    </div>
  </div>
</template>

