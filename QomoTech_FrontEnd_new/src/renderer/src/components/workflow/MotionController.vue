<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  moveAxisRel,
  subscribeMotionStatus,
  type MotionStatusSnapshot
} from '../../utils/motionApi'

const moveStep = ref(1)
const movingAxis = ref(false)
const urMode = ref(false)
let unsubscribeMotionStatus: (() => void) | null = null

const horizontalAxis = computed(() => urMode.value ? 'R' : 'X')
const verticalAxis = computed(() => urMode.value ? 'U' : 'Y')
const liftAxis = computed(() => urMode.value ? 'U' : 'Z')
const moveStepUnit = computed(() => urMode.value ? '°/圈' : 'mm')

const xyzAxisPositions = ref<{ name: string; value: string }[]>([
  { name: 'X', value: '-' },
  { name: 'Y', value: '-' },
  { name: 'Z', value: '-' },
  { name: 'U', value: '-' },
  { name: 'R', value: '-' }
])

function applyMotionSnapshot(snapshot: MotionStatusSnapshot): void {
  xyzAxisPositions.value = ['X', 'Y', 'Z', 'U', 'R'].map((name) => {
    const mpos = Number(snapshot.mposition?.[name])
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
    }
  })
}

function getAxisNameStr(axisNo: number): string {
  const map: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }
  return map[axisNo] ?? 'X'
}

async function moveAxisByDirection(axisName: string, distance: number): Promise<void> {
  if (movingAxis.value) return
  movingAxis.value = true
  try {
    const res = await moveAxisRel(axisName as 'X' | 'Y' | 'Z' | 'U' | 'R', distance, 20)
    if (!res?.success) console.warn('轴移动失败', res?.message ?? res)
  } finally {
    movingAxis.value = false
  }
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
  <div class="h-full overflow-auto p-3">
    <div class="grid grid-cols-5 gap-2">
      <div
        v-for="axis in xyzAxisPositions"
        :key="axis.name"
        class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-2 text-center"
      >
        <p class="text-[11px] text-(--app-text-muted)">{{ axis.name }} 轴</p>
        <p class="mt-0.5 text-[12px] font-semibold text-(--app-text-primary)">{{ axis.value }}</p>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-4 gap-2">
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${verticalAxis} 轴负向移动`"
        @click="moveAxisByDirection(verticalAxis, -moveStep)"
      >
        ↑
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${verticalAxis} 轴正向移动`"
        @click="moveAxisByDirection(verticalAxis, moveStep)"
      >
        ↓
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${horizontalAxis} 轴正向移动`"
        @click="moveAxisByDirection(horizontalAxis, moveStep)"
      >
        ←
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${horizontalAxis} 轴负向移动`"
        @click="moveAxisByDirection(horizontalAxis, -moveStep)"
      >
        →
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${liftAxis} 轴正向移动`"
        @click="moveAxisByDirection(liftAxis, moveStep)"
      >
        UP
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${liftAxis} 轴负向移动`"
        @click="moveAxisByDirection(liftAxis, -moveStep)"
      >
        DN
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        :class="urMode
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-primary) hover:border-blue-600 hover:text-blue-600'"
        :disabled="movingAxis"
        :title="urMode ? '当前控制 U/R 轴' : '点击后控制 U/R 轴'"
        @click="urMode = !urMode"
      >
        切换轴组
      </button>
      <label class="flex items-center rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2">
        <input
          v-model.number="moveStep"
          type="number"
          min="0"
          step="0.001"
          :title="urMode ? 'U轴按角度(°)，R轴按圈数(圈)' : 'XYZ轴按位移(mm)'"
          class="w-full bg-transparent text-center text-[11px] text-(--app-text-primary) outline-none"
        />
        <span class="text-[11px] text-(--app-text-muted)">{{ moveStepUnit }}</span>
      </label>
    </div>
  </div>
</template>
