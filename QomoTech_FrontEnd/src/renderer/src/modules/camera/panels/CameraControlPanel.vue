<script setup lang="ts">
import ControlPanelBase from '@/modules/motion/components/ControlPanelBase.vue'
import { useCameraControlPanelLogic } from './CameraControlPanel.logic'

const {
  cameraSettings,
  isCameraPanelExpanded,
  applying,
  hasPendingApplyChanges,
  handleApply
} = useCameraControlPanelLogic()
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

