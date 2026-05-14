<script setup lang="ts">
import { computed, ref } from 'vue'
import ControlPanelBase from '../components/ControlPanelBase.vue'
import OutputComponent from './OutputComponent.vue'
import { useHardwareState } from '@/shared/api/hardware'
// import {
//   emergencyStopMotion,
//   moveMotionAxisAbs,
//   subscribeHardwareStatus,
//   zeroMotionAxis,
//   type HardwareStatusPayload
// } from '@/api/motion'
// import { useNotification } from '@/shared/composables/useNotification'

const { mposition } = useHardwareState()
// const { success, error } = useNotification()

const emit = defineEmits<{(e: 'open-right-panel', target: string): void}>()

const isDriverPanelExpanded = ref(true)
// const selectedDriverAxisIndex = ref(0)
// const movingAbs = ref(false)
// const emergencyStopping = ref(false)
// const zeroingAxis = ref(false)

// type AxisEditSnapshot = {
//   commandPosition: number
//   speed: number
// }

// const axisEditCache = ref<Record<number, AxisEditSnapshot>>({})
// const editCommandPosition = ref<number>(0)
// const editSpeed = ref<number>(0)


// const selectedAxis = computed(() => {
//   const axes = controllerStore.controllerSettings.axes
//   if (!axes.length) return null
//   const i = Math.min(Math.max(0, selectedDriverAxisIndex.value), axes.length - 1)
//   return axes[i]!
// })

// const selectedAxisIdleText = computed(() => {
//   const axis = selectedAxis.value
//   if (!axis) return '-'
//   const idleNum = Number(axis.idle)
//   if (!Number.isFinite(idleNum)) return '-'
//   return idleNum === 1 ? '是' : '否'
// })

// const selectedAxisStatusText = computed(() => {
//   const axis = selectedAxis.value
//   if (!axis) return '-'
//   const status = Number(axis.axisstatus)
//   return Number.isFinite(status) ? String(status) : '-'
// })

const axisMposLabels = computed(() => {
  const axisNames = ['X', 'Y', 'Z', 'U', 'R']
  return axisNames.map((name) => {
    const v = mposition.value[name]
    return {
      name,
      value: v != null && Number.isFinite(v) ? v.toFixed(3) : '-'
    }
  })
})

// function ensureAxisEditSnapshot(axisIndex: number): AxisEditSnapshot | null {
//   const axis = controllerStore.controllerSettings.axes[axisIndex]
//   if (!axis) return null
//   if (!axisEditCache.value[axisIndex]) {
//     axisEditCache.value[axisIndex] = {
//       // 仅在创建/首次选择该轴时读取一次本地参数
//       commandPosition: Number.isFinite(axis.dpos) ? axis.dpos : 0,
//       speed: Number.isFinite(axis.speed) && axis.speed > 0 ? axis.speed : 20,
//     }
//   }
//   return axisEditCache.value[axisIndex]!
// }

// function applyEditSnapshotForSelectedAxis() {
//   const snapshot = ensureAxisEditSnapshot(selectedDriverAxisIndex.value)
//   if (!snapshot) return
//   editCommandPosition.value = snapshot.commandPosition
//   editSpeed.value = snapshot.speed
// }

// watch(
//   selectedDriverAxisIndex,
//   () => {
//     applyEditSnapshotForSelectedAxis()
//   },
//   { immediate: true }
// )

// watch(
//   () => controllerStore.controllerSettings.axes.length,
//   (len) => {
//     if (len > 0 && selectedDriverAxisIndex.value >= len) {
//       selectedDriverAxisIndex.value = len - 1
//     }
//     if (len > 0 && !axisEditCache.value[selectedDriverAxisIndex.value]) {
//       applyEditSnapshotForSelectedAxis()
//     }
//   }
// )

let ioMapForChild = ref<Array<{ digitalIn: boolean; digitalOut: boolean }>>([])

// async function handleMoveAbsByEnter() {
//   const axis = selectedAxis.value
//   if (!axis || movingAbs.value) return

//   const target = Number(editCommandPosition.value)
//   const speed = Number(editSpeed.value)
//   if (!Number.isFinite(target)) {
//     error('请输入有效的指令位置')
//     return
//   }
//   if (!Number.isFinite(speed) || speed <= 0) {
//     error('请输入有效的速度（> 0）')
//     return
//   }

//   movingAbs.value = true
//   try {
//     const res = await moveMotionAxisAbs(axis.axisNo, target, {
//       speed,
//       controllerSettings: controllerStore.controllerSettings
//     })
//     if (!res?.success) {
//       error(res?.message || '绝对移动失败')
//       return
//     }

//     axisEditCache.value[selectedDriverAxisIndex.value] = {
//       commandPosition: target,
//       speed,
//     }
//     success('绝对移动指令已发送')
//   } finally {
//     movingAbs.value = false
//   }
// }

// async function handleEmergencyStop() {
//   const axis = selectedAxis.value
//   if (!axis) {
//     error('未选择轴')
//     return
//   }
//   if (emergencyStopping.value) return
//   emergencyStopping.value = true
//   try {
//     const res = await emergencyStopMotion(axis.axisNo)
//     if (!res?.success) {
//       error(res?.message || '急停失败')
//       return
//     }
//     success(res?.message || '急停成功')
//   } finally {
//     emergencyStopping.value = false
//   }
// }

// async function handleZeroSelectedAxisPosition() {
//   const axis = selectedAxis.value
//   if (!axis) {
//     error('未选择轴')
//     return
//   }
//   if (zeroingAxis.value || movingAbs.value) return
//   zeroingAxis.value = true
//   try {
//     const res = await zeroMotionAxis(axis.axisNo)
//     if (!res?.success) {
//       error(res?.message || '位置清零失败')
//       return
//     }
//     const idx = selectedDriverAxisIndex.value
//     const snap = axisEditCache.value[idx]
//     if (snap) snap.commandPosition = 0
//     editCommandPosition.value = 0
//     if (Number.isFinite(axis.dpos)) axis.dpos = 0
//     success(res?.message || '当前轴位置已清零')
//   } finally {
//     zeroingAxis.value = false
//   }
// }
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isDriverPanelExpanded"
    title="控制驱动器面板"
    action-target="ControllerSettings"
    content-always-visible
    :class="isDriverPanelExpanded ? 'min-h-[min(250px,42vh)]' : ''"
    @open-right-panel="(target) => emit('open-right-panel', target)"
  >
    <template #default>
      <!-- <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <label class="mb-3 flex w-full min-w-0 items-center gap-2">
          <span class="shrink-0 text-xs text-(--app-text-muted)">驱动器轴</span>
          <select
            v-model.number="selectedDriverAxisIndex"
            class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition scheme-light focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-black/40 dark:scheme-dark"
            :disabled="!controllerStore.controllerSettings.axes.length"
          >
            <option
              v-for="(axis, i) in controllerStore.controllerSettings.axes"
              :key="i"
              :value="i"
              class="bg-(--app-input-bg) text-(--app-text-primary)"
            >
              {{ axis.axisName || `轴 ${i + 1}` }}
            </option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">指令位置 target_pos</span>
            <input
              v-model.number="editCommandPosition"
              type="number"
              step="0.001"
              :disabled="movingAbs"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none dark:shadow-black/40"
              @keydown.enter.prevent="handleMoveAbsByEnter"
            />
          </label>
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">实际速度 actual_speed</span>
            <input
              v-model.number="editSpeed"
              type="number"
              min="0"
              step="0.001"
              :disabled="movingAbs"
              class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none dark:shadow-black/40"
            />
          </label>
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">空闲状态 idle_status</span>
            <input
              :value="selectedAxisIdleText"
              type="text"
              readonly
              class="w-full cursor-not-allowed rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none dark:shadow-black/40"
            />
          </label>
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-xs text-(--app-text-muted)">轴状态 axis_status</span>
            <input
              :value="selectedAxisStatusText"
              type="text"
              readonly
              class="w-full cursor-not-allowed rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none dark:shadow-black/40"
            />
          </label>
        </div>
      </div> -->

      <!-- <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :title="zeroingAxis ? '执行回零' : '执行回零操作中...'"
          :disabled="zeroingAxis || movingAbs || !controllerStore.controllerSettings.axes.length"
          class="rounded-lg border border-sky-500 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900/45"
          @click="handleZeroSelectedAxisPosition"
        >
          {{ zeroingAxis ? '执行回零中...' : '执行回零' }}
        </button>
        <button
          type="button"
          :title="emergencyStopping ? '停止执行中' : '立刻停止选中轴并清空该轴缓存'"
          :disabled="emergencyStopping"
          class="rounded-lg border border-yellow-500 bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-900/45"
          @click="handleEmergencyStop"
        >
          {{ emergencyStopping ? '停止中...' : '立刻停止选中轴并清空该轴缓存' }}
        </button>
      </div> -->

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
        <OutputComponent :motion-io-map="ioMapForChild" />
      </div>
    </template>
  </ControlPanelBase>
</template>
