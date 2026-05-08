<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'
import OutputComponent from './OutputComponent.vue'
import {
  subscribeMotionStatus,
  type MotionStatusSnapshot
} from '../utils/motionApi'

const emit = defineEmits<{(e: 'open-right-panel', target: string): void}>()

const isDriverPanelExpanded = ref(true)
let unsubscribeMotionStatus: (() => void) | null = null

const axisMposLabels = ref<{ name: string; value: string }[]>([
  { name: 'X', value: '-' },
  { name: 'Y', value: '-' },
  { name: 'Z', value: '-' },
  { name: 'U', value: '-' },
  { name: 'R', value: '-' }
])

function applyMotionSnapshot(snapshot: MotionStatusSnapshot): void {
  axisMposLabels.value = ['X', 'Y', 'Z', 'U', 'R'].map((name) => {
    const mpos = Number(snapshot.mposition?.[name])
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
    }
  })
}

onMounted(() => {
  unsubscribeMotionStatus = subscribeMotionStatus((snapshot) => {
    applyMotionSnapshot(snapshot)
  }, { autoStart: true, emitLatest: true })
})

onUnmounted(() => {
  unsubscribeMotionStatus?.()
  unsubscribeMotionStatus = null
})
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isDriverPanelExpanded ? 'min-h-[min(250px,42vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isDriverPanelExpanded"
      title="控制驱动器面板"
      action-target="ControllerSettings"
      @open-right-panel="(target) => emit('open-right-panel', target)"
    />
    <div v-show="true" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div class="grid grid-cols-5 gap-2">
          <label
            v-for="item in axisMposLabels"
            :key="item.name"
            class="flex min-w-0 flex-col gap-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-2"
          >
            <span class="text-[11px] text-(--app-text-muted)">{{ item.name }} 轴</span>
            <span class="truncate text-xs font-medium text-(--app-text-primary)">{{ item.value }}</span>
          </label>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <OutputComponent />
      </div>
    </div>
  </div>
</template>
