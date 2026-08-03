<script setup lang="ts">
import { inject, reactive, onMounted } from 'vue'
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
</script>

<template>
  <div class="mt-2 space-y-3">
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3 text-xs text-(--app-text-muted)">
      <p>五轴校准。设备按设定角度依次旋转，并触发激光打点。</p>
      <p class="mt-1">请结合相机或实物打点结果录入人工偏差，便于后续补偿计算</p>
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
      <FormField v-model="state.axisCenterCalibSpeed" label="采样轴速度" :min="0.01" :step="0.1" :disabled="state.isAxisCenterCalib" />
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
    <div class="space-y-2">
      <button
        type="button"
        :disabled="state.isAxisCenterCalib || state.isSavingRAxisPosition"
        class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-4 py-2 text-sm font-medium text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-card) disabled:cursor-not-allowed disabled:opacity-50"
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
        <div class="mt-3 grid gap-2 lg:grid-cols-3">
          <FormField v-model="sample.observedOffsetX" label="人工偏差 X(mm)" :disabled="state.isAxisCenterCalib" />
          <FormField v-model="sample.observedOffsetY" label="人工偏差 Y(mm)" :disabled="state.isAxisCenterCalib" />
          <div class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
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
    </div>
    <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
      <p class="text-xs text-(--app-text-muted)">中心点基准 XY 累加值</p>
      <div v-if="state.axisCenterCalibCenterBasedXYSum" class="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatusCard label="X补偿值" :value="state.axisCenterCalibCenterBasedXYSum.X.toFixed(3)" variant="card" />
        <StatusCard label="Y补偿值" :value="state.axisCenterCalibCenterBasedXYSum.Y.toFixed(3)" variant="card" />
        <StatusCard label="Z补偿值" :value="state.axisCenterCalibCenterBasedXYSum.Z.toFixed(3)" variant="card" />
      </div>
      <p v-else class="mt-2 text-xs text-(--app-text-muted)">请先完成全部采样点的 XY 位置记录</p>
    </div>
    <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatusCard label="人工偏差均值 X" :value="state.axisCenterCalibManualSummary.avgX === null ? '-' : state.axisCenterCalibManualSummary.avgX.toFixed(3)" />
      <StatusCard label="人工偏差均值 Y" :value="state.axisCenterCalibManualSummary.avgY === null ? '-' : state.axisCenterCalibManualSummary.avgY.toFixed(3)" />
      <StatusCard label="偏差峰峰值 X" :value="state.axisCenterCalibManualSummary.spanX === null ? '-' : state.axisCenterCalibManualSummary.spanX.toFixed(3)" />
      <StatusCard label="偏差峰峰值 Y" :value="state.axisCenterCalibManualSummary.spanY === null ? '-' : state.axisCenterCalibManualSummary.spanY.toFixed(3)" />
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
