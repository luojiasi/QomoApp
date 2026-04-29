<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSelfProcessStore } from '../stores/selfProcessStores'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import FlowTaskPanel from '../components/workflow/FlowTaskPanel.vue'
import FlowCanvas from '../components/workflow/FlowCanvas.vue'
import FlowNodeConfig from '../components/workflow/FlowNodeConfig.vue'
import FlowLogPanel from '../components/workflow/FlowLogPanel.vue'
import CameraPic from '@/components/cameraPic.vue'
import {
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  subscribeHardwareStatus,
  type HardwareStatusPayload
} from '../utils/motionApi'

const store = useSelfProcessStore()
const controllerStore = useControllerSettingsStore()
const moveStep = ref(1)
const movingAxis = ref(false)
const urMode = ref(false)
let unsubscribeHardwareStatus: (() => void) | null = null

const horizontalAxis = computed(() => urMode.value ? { no: 4, name: 'R' } : { no: 0, name: 'X' })
const verticalAxis = computed(() => urMode.value ? { no: 3, name: 'U' } : { no: 1, name: 'Y' })
const liftAxis = computed(() => urMode.value ? { no: 3, name: 'U' } : { no: 2, name: 'Z' })
const moveStepUnit = computed(() => urMode.value ? '°/圈' : 'mm')

const xyzAxisPositions = computed(() =>
  ['X', 'Y', 'Z','U','R'].map((name, axisNo) => {
    const axis = controllerStore.controllerSettings.axes.find((item) => item.axisNo === axisNo)
    const mpos = axis ? Number(axis.mpos) : NaN
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
    }
  })
)

function applyMotionStatusToAxes(statusData: Record<string, Record<string, unknown>>): void {
  const axes = controllerStore.controllerSettings.axes
  if (!axes.length) return

  for (const axis of axes) {
    const status = statusData[String(axis.axisNo)]
    if (!status || typeof status !== 'object') continue

    const mpos = Number(status.mpos)
    if (Number.isFinite(mpos)) axis.mpos = mpos
  }
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
      if (!res?.success) {
        console.warn('U轴旋转失败', res?.message ?? res)
      }
      return
    }

    if (urMode.value && axisNo === 4) {
      const res = await rotateRAxisByTurns({
        旋转圈数: absDistance,
        旋转速度: speed,
        旋转方向: rotateDirection,
        运动模式: 'relative'
      })
      if (!res?.success) {
        console.warn('R轴旋转失败', res?.message ?? res)
      }
      return
    }

    const res = await moveMotionAxisRel(axisNo, distance, {
      controllerSettings: controllerStore.controllerSettings
    })
    if (!res?.success) {
      console.warn('轴移动失败', res?.message ?? res)
    }
  } finally {
    movingAxis.value = false
  }
}

function getAxisSpeed(axisNo: number): number {
  const value = Number(controllerStore.controllerSettings.axes[axisNo]?.speed)
  return Number.isFinite(value) && value > 0 ? value : 20
}

onMounted(async () => {
  await store.init()
  unsubscribeHardwareStatus = subscribeHardwareStatus((res) => {
    if (!res?.success || !res.data || typeof res.data !== 'object') return
    const payload = res.data as HardwareStatusPayload
    const axisData = payload.state?.motion_axis_feedback ?? payload.motion_driver_status?.axis_status
    if (!axisData || typeof axisData !== 'object') return

    applyMotionStatusToAxes(axisData as Record<string, Record<string, unknown>>)
  }, {
    autoStart: true,
    intervalMs: 50,
    runImmediately: true
  })
})

onUnmounted(() => {
  unsubscribeHardwareStatus?.()
  unsubscribeHardwareStatus = null
})
</script>

<template>
  <div
      class="flex shrink-0 items-center gap-4 rounded-2xl border border-(--app-border) bg-(--app-card) px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
    >
      <div class="flex min-w-[220px] flex-col gap-0.5">
        <h1 class="text-lg font-bold leading-tight text-(--app-text-primary)">自定流程</h1>
        <span class="text-xs text-(--app-text-muted)">
          {{ store.currentWorkflow ? store.currentWorkflow.name : '创建流程后开始编排节点' }}
        </span>
      </div>
      <div class="flex flex-1 justify-center gap-2">
        <button
          class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white opacity-100 shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition-all duration-100 enabled:hover:-translate-y-px enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          :disabled="!store.currentWorkflow || store.isSaving"
          @click="store.saveWorkflow()"
        >
          {{ store.isSaving ? '保存中...' : '保存流程' }}
        </button>
        <button
          v-if="!store.isRunning"
          class="cursor-pointer rounded-lg border border-green-500/30 bg-green-600 px-5 py-2 text-[13px] font-semibold text-white opacity-100 shadow-[0_8px_18px_rgba(22,163,74,0.18)] transition-all duration-100 enabled:hover:-translate-y-px enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          :disabled="!store.currentWorkflow || !store.currentWorkflow.firstNodeId"
          @click="store.runWorkflow()"
        >
          运行
        </button>
        <button
          v-else
          class="cursor-pointer rounded-lg border border-red-500/30 bg-red-600 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.2)] transition-all duration-100 hover:-translate-y-px hover:bg-red-700"
          @click="store.stopWorkflow()"
        >
          停止
        </button>
      </div>
      <div class="flex items-center">
        <RouterLink
          to="/home"
          class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-25 py-2 text-[13px] text-(--app-text-muted) no-underline transition-colors duration-100 hover:text-(--app-text-primary)"
        >
          返回首页
        </RouterLink>
      </div>
    </div>
  <div class="absolute top-1/16 bottom-4 z-20 flex min-h-0 w-full flex-row gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <aside class="h-full w-1/8 overflow-hidden">
      <FlowTaskPanel />
    </aside>


    <main class="h-full w-3/4 flex-col items-center overflow-hidden">
        <div class="h-1/2 w-full shrink-0">
          <FlowCanvas class="h-full w-full" />
        </div>
        <div class="w-full shrink-0 overflow-hidden">
          <FlowNodeConfig />
        </div>
        <div class="w-full shrink-0 overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card) p-3">
          <div class="grid grid-cols-9 gap-2">
            <div
              v-for="axis in xyzAxisPositions"
              :key="axis.name"
              class="flex min-w-0 flex-col rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-2"
            >
              <span class="text-[11px] text-(--app-text-muted)">{{ axis.name }} 轴:{{ axis.value }}</span>
            </div>
            <div class="col-span-4 flex items-center gap-1 justify-between">
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
                :class="urMode ? 'border-blue-600 bg-blue-600 text-white' : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-primary) hover:border-blue-600 hover:text-blue-600'"
                :disabled="movingAxis"
                :title="urMode ? '当前控制 U/R 轴' : '点击后控制 U/R 轴'"
                @click="urMode = !urMode"
              >
                切换
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
        </div>
      </main>


    <aside class="flex h-full w-2/9 flex-col overflow-hidden">
      <div class="h-2/5 overflow-hidden rounded-xl border border-(--app-border)">
        <CameraPic object-fit="cover" />
      </div>
      <div class="h-3/5 overflow-hidden">
        <FlowLogPanel />
      </div>
    </aside>

  </div>
</template>
