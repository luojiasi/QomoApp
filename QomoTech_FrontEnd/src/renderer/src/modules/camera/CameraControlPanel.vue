<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import ControlPanelBase from '@/modules/motion/panels/ControlPanelBase.vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useCameraSettingsStore } from './useCameraStore'
import {
  bootstrapCameraSettings,
  disconnectCamera,
  initSdkEnumAndConnectIndex0
} from './cameraApi'

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

    // 2. 在 IDLE 状态下缓存引导参数，connect 时后端自动下发
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

    // 3. 重连，后端 connect() 中自动下发缓存的引导参数
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
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isCameraPanelExpanded"
    title="相机参数面板"
    :class="isCameraPanelExpanded ? 'min-h-[min(180px,40vh)]' : ''"
  >
    <template #default>
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

          <label class="col-span-1 flex min-w-0 flex-row items-center gap-2 rounded-lg border border-(--app-border) px-3 py-2">
            <input id="mirror-h" v-model="cameraSettings.mirrorHorizontal" type="checkbox" class="h-4 w-4" />
            <span class="text-xs text-(--app-text-muted)">水平镜像</span>
          </label>

          <label class="col-span-1 flex min-w-0 flex-row items-center gap-2 rounded-lg border border-(--app-border) px-3 py-2">
            <input id="mirror-v" v-model="cameraSettings.mirrorVertical" type="checkbox" class="h-4 w-4" />
            <span class="text-xs text-(--app-text-muted)">垂直镜像</span>
          </label>
        </div>
      </div>
    </template>

    <template #footer>
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
    </template>
  </ControlPanelBase>
</template>

