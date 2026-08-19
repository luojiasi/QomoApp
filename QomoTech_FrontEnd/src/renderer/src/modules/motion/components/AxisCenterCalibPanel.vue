<script setup lang="ts">
import { computed, inject, reactive, onMounted } from 'vue'
import StatusCard from '@/shared/components/StatusCard.vue'
import FormField from '@/shared/components/FormField.vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'
import SafetyConfirm from '@/shared/components/SafetyConfirm.vue'
import { axisCenterCalibDisplayAxes } from '../composables/useAxisCenterCalib'

const state = reactive(inject<any>('axisCalib')!)

onMounted(() => {
  state.loadAxisCenterCalibOffset()
  void state.loadRAxisPosition()
})

const ruCenterDiffX = computed(() => {
  const r = state.savedRAxisPosition as { X: number } | null
  const uX = Number(state.axisCenterCalibEditX)
  if (!r || !Number.isFinite(r.X) || !Number.isFinite(uX)) return null
  return r.X - uX
})

function ruDiffToneClass(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 0.1) return 'border-emerald-500/50 bg-emerald-500/15'
  if (abs <= 0.2) return 'border-amber-400/55 bg-amber-400/15'
  return 'border-red-500/50 bg-red-500/15'
}

function ruDiffValueClass(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 0.1) return 'text-emerald-200'
  if (abs <= 0.2) return 'text-amber-200'
  return 'text-red-200'
}

function formatRuDiff(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(3)}`
}
</script>

<template>
  <div class="mt-2 space-y-3">
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3 text-xs text-(--app-text-muted)">
      <p>五轴校准。设备按设定角度依次旋转，并触发激光打点。</p>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div
        v-for="(step, index) in state.axisCenterCalibStepItems"
        :key="step.id"
        class="rounded-lg border px-2 py-2 text-center text-xs"
        :class="
          state.getAxisCenterCalibStepState(index) === 'done'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-(--app-text-primary)'
            : state.getAxisCenterCalibStepState(index) === 'current'
              ? 'border-sky-500/50 bg-sky-500/10 text-(--app-text-primary)'
              : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-muted)'
        "
      >
        {{ Number(index) + 1 }}. {{ step.label }}
      </div>
    </div>
    <div class="grid gap-3 grid-cols-4">
      <FormField
        v-model="state.axisCenterCalibRotationAxisNo"
        label="旋转轴"
        type="select"
        :disabled="state.isAxisCenterCalib"
        :options="[{ value: 3, label: 'U 轴' }, { value: 4, label: 'R 轴' }]"
      />
      <FormField v-model="state.axisCenterCalibStartAngle" label="起始角" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibAngleStep" label="角度步长" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibSampleCount" label="采样点数" :min="3" :step="2" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibSpeed" label="旋转轴速度" :min="0.01" :step="0.1" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibZLiftAbsMm" label="Z抬升位置(mm)" :step="0.1" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibZLiftSpeed" label="Z抬升速度(%)" :min="0.01" :step="0.1" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibSettleMs" label="等待时间(ms)" :min="0" :step="1" :disabled="state.isAxisCenterCalib" />
      <FormField v-model="state.axisCenterCalibLaserPulseMs" label="激光时间(ms)" :min="0" :step="1" :disabled="state.isAxisCenterCalib || !state.axisCenterCalibAutoPulse" />
    </div>
    <div class="grid gap-3 grid-cols-2">
      <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
        <input v-model="state.axisCenterCalibAutoPulse" type="checkbox" :disabled="state.isAxisCenterCalib" />
        自动打点
      </label>
      <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
        <input v-model="state.axisCenterCalibReturnToStart" type="checkbox" :disabled="state.isAxisCenterCalib" />
        结束后回起始角
      </label>
    </div>
    <SafetyConfirm v-model="state.axisCenterCalibSafetyConfirmed" :disabled="state.isAxisCenterCalib" message="已确认相机对焦完成、工件固定可靠、激光功率处于安全校准档位。" />
    <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatusCard label="当前阶段" :value="state.axisCenterCalibPhaseLabel" />
      <StatusCard label="目标旋转轴" :value="state.axisCenterCalibRotationAxisLabel" />
      <StatusCard label="当前角度" :value="state.axisCenterCalibCurrentAngleText" />
      <StatusCard label="失败信息" :value="state.axisCenterCalibErrorMessage || '-'" />
    </div>
    <div class="space-y-2 rounded-xl border border-amber-400/55 bg-amber-400/10 p-3">
      <p class="text-xs font-medium text-amber-200">将当前 XYZ 记为 R 轴旋转中心</p>
      <button
        type="button"
        :disabled="state.isAxisCenterCalib || state.isSavingRAxisPosition"
        class="w-full rounded-lg border border-amber-300 bg-amber-400 px-4 py-2.5 text-sm font-semibold tracking-wide text-zinc-950 shadow-[0_0_18px_rgba(251,191,36,0.28)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        @click="state.handleSaveRAxisPosition"
      >
        {{ state.isSavingRAxisPosition ? '保存中...' : '记录R轴旋转中心' }}
      </button>
      <div class="grid grid-cols-3 gap-2">
        <StatusCard label="已存 R 中心 X" :value="state.displaySavedRAxisAxis('X')" />
        <StatusCard label="已存 R 中心 Y" :value="state.displaySavedRAxisAxis('Y')" />
        <StatusCard label="已存 R 中心 Z" :value="state.displaySavedRAxisAxis('Z')" />
      </div>
    </div>
    <div class="flex gap-2">
      <PrimaryButton :disabled="state.isAxisCenterCalib" class="flex-1" @click="state.handleAxisCenterCalib">
        {{ state.isAxisCenterCalib ? '校准采样中...' : '开始五轴中心校准' }}
      </PrimaryButton>
      <button
        type="button"
        :disabled="state.isAxisCenterCalib"
        class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-4 py-2 text-sm font-medium text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-card) disabled:cursor-not-allowed disabled:opacity-50"
        @click="state.resetAxisCenterCalibWorkflow"
      >
        重置
      </button>
    </div>
    <div class="grid gap-2 lg:grid-cols-5">
      <StatusCard
        v-for="position in state.axisCenterCalibLivePositions"
        :key="position.name"
        :label="`${position.name} 当前位置`"
        :value="position.value"
      />
    </div>
    <div class="space-y-2">
      <div
        v-for="sample in state.axisCenterCalibSamples"
        :key="sample.id"
        class="rounded-xl border p-3"
        :class="state.getAxisCenterCalibSampleClass(sample.state)"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-(--app-text-primary)">
            第 {{ sample.id + 1 }} 点 / {{ sample.angle.toFixed(3) }}°
          </p>
          <span class="text-xs text-(--app-text-muted)">
            {{
              sample.state === 'done'
                ? '已完成'
                : sample.state === 'current'
                  ? '执行中'
                  : sample.state === 'failed'
                    ? '失败'
                    : '待执行'
            }}
          </span>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-(--app-text-muted) lg:grid-cols-5">
          <div
            v-for="axisName in axisCenterCalibDisplayAxes"
            :key="axisName"
            class="rounded-lg border border-(--app-border) bg-(--app-card) px-2 py-2"
          >
            <p>{{ axisName }}</p>
            <p class="mt-1 text-sm text-(--app-text-primary)">{{ state.displaySampleAxisPosition(sample, axisName) }}</p>
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-1 text-xs text-(--app-text-muted)">
          手动记录位置
          <button
            type="button"
            :disabled="!((!state.isAxisCenterCalib) || state.axisCenterCalibPendingRecordSampleId === sample.id)"
            class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-input-bg) disabled:cursor-not-allowed disabled:opacity-50"
            @click="state.handleManualRecordAxisCenterCalibSample(sample.id)"
          >
            {{
              state.axisCenterCalibPendingRecordSampleId === sample.id
                ? '标记并继续'
                : state.hasSampleMachinePositions(sample)
                  ? '重记位置'
                  : '记当前位置'
            }}
          </button>
        </div>
      </div>
    </div>
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
      <p class="text-xs text-(--app-text-muted)">U 轴旋转中心（采样计算后的结果，改完点应用即可覆盖）</p>
      <div class="mt-2 grid gap-2 lg:grid-cols-4">
        <FormField
          v-model="state.axisCenterCalibEditX"
          label="X"
          :step="0.001"
          :disabled="state.isAxisCenterCalib || state.isApplyingAxisCenterCalibCenter"
        />
        <FormField
          v-model="state.axisCenterCalibEditY"
          label="Y"
          :step="0.001"
          :disabled="state.isAxisCenterCalib || state.isApplyingAxisCenterCalibCenter"
        />
        <FormField
          v-model="state.axisCenterCalibEditZ"
          label="Z"
          :step="0.001"
          :disabled="state.isAxisCenterCalib || state.isApplyingAxisCenterCalibCenter"
        />
        <div class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
          覆盖自动计算
          <button
            type="button"
            :disabled="state.isAxisCenterCalib || state.isApplyingAxisCenterCalibCenter"
            class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-input-bg) disabled:cursor-not-allowed disabled:opacity-50"
            @click="state.applyAxisCenterCalibCenter"
          >
            {{ state.isApplyingAxisCenterCalibCenter ? '应用中...' : '应用' }}
          </button>
        </div>
      </div>
    </div>
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
      <p class="text-xs text-(--app-text-muted)">R − U 旋转中心差 ΔX（绿 ≤0.1　黄 0.1–0.2　红 >0.2）</p>
      <div v-if="ruCenterDiffX !== null" class="mt-2">
        <div
          class="rounded-lg border px-3 py-2"
          :class="ruDiffToneClass(ruCenterDiffX)"
        >
          <p class="text-xs text-(--app-text-muted)">ΔX</p>
          <p class="mt-1 text-sm font-medium" :class="ruDiffValueClass(ruCenterDiffX)">
            {{ formatRuDiff(ruCenterDiffX) }}
          </p>
        </div>
      </div>
      <p v-else class="mt-2 text-xs text-(--app-text-muted)">请先记录 R 轴旋转中心，并确认 U 轴 X 有效</p>
    </div>
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
      <p class="text-xs text-(--app-text-muted)">执行日志</p>
      <div class="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-(--app-text-primary)">
        <p v-for="item in state.axisCenterCalibLogs" :key="item">{{ item }}</p>
        <p v-if="state.axisCenterCalibLogs.length === 0" class="text-(--app-text-muted)">尚未开始采样</p>
      </div>
    </div>
  </div>
</template>
