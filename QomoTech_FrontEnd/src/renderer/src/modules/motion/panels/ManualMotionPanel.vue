<script setup lang="ts">
import { toRef } from 'vue'
import { useAxisJog } from '@/modules/motion/composables/motion/useAxisJog'

const props = defineProps<{
  axisCount: number
  axisLabels: string[]
}>()

const {
  axisIndices, axisRelativeInputs, axisAbsoluteInputs, zeroingAxis,
  normalizeManualInput, isBusy,
  relPlaceholder, relLabel, absPlaceholder, absLabel,
  handleRelativeMove, handleAbsoluteMove, handleZeroAxis
} = useAxisJog(toRef(props, 'axisCount'))

defineExpose({ axisIndices, axisRelativeInputs, axisAbsoluteInputs })
</script>

<template>
  <div class="app-card rounded-2xl p-5 shadow-sm">
    <div class="flex items-baseline justify-between gap-2 mb-3">
      <h3 class="text-sm font-semibold app-text-primary">手动运动</h3>
    </div>
    <div class="flex flex-row gap-2">
      <div
        v-for="axisIdx in axisIndices"
        :key="`manual-${axisIdx}`"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-(--app-border) p-3"
      >
        <span class="w-16 text-sm font-semibold app-text-primary shrink-0">
          轴{{ axisIdx }} <span class="text-xs font-normal opacity-60">{{ axisLabels[axisIdx] }}</span>
        </span>

        <button
          type="button"
          class="rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-900/40 disabled:opacity-50"
          :disabled="Boolean(zeroingAxis[axisIdx]) || isBusy(axisIdx)"
          @click="handleZeroAxis(axisIdx)"
        >
          {{ zeroingAxis[axisIdx] ? '...' : '归零' }}
        </button>

        <input
          v-model.number="axisRelativeInputs[axisIdx]"
          type="number"
          step="0.0001"
          :disabled="isBusy(axisIdx)"
          class="w-28 rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 disabled:opacity-50"
          :placeholder="relPlaceholder(axisIdx)"
          @blur="normalizeManualInput('rel', axisIdx)"
        />
        <button
          type="button"
          class="rounded-md border border-blue-500/40 bg-blue-600/80 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          :disabled="isBusy(axisIdx)"
          @click="handleRelativeMove(axisIdx)"
        >
          {{ relLabel(axisIdx) }}
        </button>

        <input
          v-model.number="axisAbsoluteInputs[axisIdx]"
          type="number"
          step="0.0001"
          :disabled="isBusy(axisIdx)"
          class="w-28 rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-indigo-500/30 focus:border-indigo-500/50 focus:ring-2 disabled:opacity-50"
          :placeholder="absPlaceholder(axisIdx)"
          @blur="normalizeManualInput('abs', axisIdx)"
        />
        <button
          type="button"
          class="rounded-md border border-indigo-500/40 bg-indigo-600/85 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          :disabled="isBusy(axisIdx)"
          @click="handleAbsoluteMove(axisIdx)"
        >
          {{ absLabel(axisIdx) }}
        </button>
      </div>
    </div>
  </div>
</template>
