<script setup lang="ts">
import { computed, ref } from 'vue'
import { useControllerSettingsStore } from '../../stores/controllerSettingsStore'
import {
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle
} from '../../api/motion'

const controllerStore = useControllerSettingsStore()

const moveStep = ref(1)
const movingAxis = ref(false)
const urMode = ref(false)

const horizontalAxis = computed(() => urMode.value ? { no: 4, name: 'R' } : { no: 0, name: 'X' })
const verticalAxis = computed(() => urMode.value ? { no: 3, name: 'U' } : { no: 1, name: 'Y' })
const liftAxis = computed(() => urMode.value ? { no: 3, name: 'U' } : { no: 2, name: 'Z' })
const moveStepUnit = computed(() => urMode.value ? '°/圈' : 'mm')

const xyzAxisPositions = computed(() =>
  ['X', 'Y', 'Z', 'U', 'R'].map((name, axisNo) => {
    const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
    const mpos = axis ? Number(axis.mpos) : NaN
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
    }
  })
)

function getAxisSpeed(axisNo: number): number {
  const value = Number(controllerStore.controllerSettings.axes[axisNo]?.speed)
  return Number.isFinite(value) && value > 0 ? value : 20
}

async function moveAxisByDirection(axisNo: number, distance: number): Promise<void> {
  if (movingAxis.value) return

  movingAxis.value = true
  try {
    const rotateDirection = distance >= 0 ? '顺时针' : '逆时针'
    const absDistance = Math.abs(distance)
    const speed = getAxisSpeed(axisNo)

    if (urMode.value && axisNo === 3) {
      const res = await rotateUAxisByAngle({
        旋转角度: absDistance,
        旋转速度: speed,
        旋转方向: rotateDirection,
        运动模式: 'relative'
      })
      if (!res?.success) console.warn('U轴旋转失败', res?.message ?? res)
      return
    }

    if (urMode.value && axisNo === 4) {
      const res = await rotateRAxisByTurns({
        旋转圈数: absDistance,
        旋转速度: speed,
        旋转方向: rotateDirection,
        运动模式: 'relative'
      })
      if (!res?.success) console.warn('R轴旋转失败', res?.message ?? res)
      return
    }

    const res = await moveMotionAxisRel(axisNo, distance, {
      controllerSettings: controllerStore.controllerSettings
    })
    if (!res?.success) console.warn('轴移动失败', res?.message ?? res)
  } finally {
    movingAxis.value = false
  }
}

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
        :title="`${verticalAxis.name} 轴负向移动`"
        @click="moveAxisByDirection(verticalAxis.no, -moveStep)"
      >
        ↑
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${verticalAxis.name} 轴正向移动`"
        @click="moveAxisByDirection(verticalAxis.no, moveStep)"
      >
        ↓
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${horizontalAxis.name} 轴正向移动`"
        @click="moveAxisByDirection(horizontalAxis.no, moveStep)"
      >
        ←
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${horizontalAxis.name} 轴负向移动`"
        @click="moveAxisByDirection(horizontalAxis.no, -moveStep)"
      >
        →
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${liftAxis.name} 轴正向移动`"
        @click="moveAxisByDirection(liftAxis.no, moveStep)"
      >
        UP
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text-primary) transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="movingAxis"
        :title="`${liftAxis.name} 轴负向移动`"
        @click="moveAxisByDirection(liftAxis.no, -moveStep)"
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
