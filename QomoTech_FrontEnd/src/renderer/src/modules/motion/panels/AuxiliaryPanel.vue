<script setup lang="ts">
import ControlPanelBase from '../components/ControlPanelBase.vue'
import { useAuxiliaryPanelLogic } from './AuxiliaryPanel.logic'

const {
    isPanelExpanded,
    activeTab,
    tabs,
        isQuickFocusing,
    isAxisCenterCalib,
    axisCenterCalibErrorMessage,
    axisCenterCalibRotationAxisNo,
    axisCenterCalibStartAngle,
    axisCenterCalibAngleStep,
    axisCenterCalibSampleCount,
    axisCenterCalibSettleMs,
    axisCenterCalibLaserPulseMs,
    axisCenterCalibAutoPulse,
    axisCenterCalibReturnToStart,
    axisCenterCalibSafetyConfirmed,
    axisCenterCalibSamples,
    axisCenterCalibLogs,
    axisCenterCalibPendingRecordSampleId,
    axisCenterCalibRotationAxisLabel,
    axisCenterCalibPhaseLabel,
    axisCenterCalibStepItems,
    axisCenterCalibLivePositions,
    axisCenterCalibCurrentAngleText,
    axisCenterCalibManualSummary,
    axisCenterCalibDisplayAxes,
    getAxisCenterCalibStepState,
    getAxisCenterCalibSampleClass,
    displaySampleAxisPosition,
    hasSampleMachinePositions,
    handleManualRecordAxisCenterCalibSample,
    resetAxisCenterCalibWorkflow,
    handleAxisCenterCalib,
    quickFocusGridSize,
    quickFocusStep,
    quickFocusZStep,
    quickFocusPoints,
    quickFocusDotGridStyle,
    getQuickFocusPointClass,
    handleQuickFocus,
    handleQuickConcentric,
    handleSaveQuickMoveToPosition,
    displayQuickMoveAxis,
    axisCenterCalibCenterBasedXYSum
} = useAuxiliaryPanelLogic()
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isPanelExpanded"
    title="辅助功能区"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <template #default>
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
        <div class="flex flex-col-5 gap-2">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
            :class="
              activeTab === item.id
                ? 'border-sky-500/70 bg-sky-500/10 text-(--app-text-primary)'
                : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-primary) hover:border-sky-500/35 hover:bg-(--app-card)'
            "
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div v-if="activeTab === 'axisCenterCalib'" class="mt-2 space-y-3">
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3 text-xs text-(--app-text-muted)">
            <p>五轴校准。设备按设定角度依次旋转，并触发激光打点。</p>
            <p class="mt-1">请结合相机或实物打点结果录入人工偏差，便于后续补偿计算</p>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div
              v-for="(step, index) in axisCenterCalibStepItems"
              :key="step.id"
              class="rounded-lg border px-2 py-2 text-center text-xs"
              :class="
                getAxisCenterCalibStepState(index) === 'done'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-(--app-text-primary)'
                  : getAxisCenterCalibStepState(index) === 'current'
                    ? 'border-sky-500/50 bg-sky-500/10 text-(--app-text-primary)'
                    : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-muted)'
              "
            >
              {{ index + 1 }}. {{ step.label }}
            </div>
          </div>
          <div class="grid gap-3 grid-cols-4">
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              旋转轴
              <select
                v-model.number="axisCenterCalibRotationAxisNo"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option :value="3">U 轴</option>
                <option :value="4">R 轴</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              起始角
              <input
                v-model.number="axisCenterCalibStartAngle"
                type="number"
                step="any"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              角度步长
              <input
                v-model.number="axisCenterCalibAngleStep"
                type="number"
                step="any"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              采样点数
              <input
                v-model.number="axisCenterCalibSampleCount"
                type="number"
                min="3"
                step="2"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              等待时间(ms)
              <input
                v-model.number="axisCenterCalibSettleMs"
                type="number"
                min="0"
                step="1"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              激光时间(ms)
              <input
                v-model.number="axisCenterCalibLaserPulseMs"
                type="number"
                min="0"
                step="1"
                :disabled="isAxisCenterCalib || !axisCenterCalibAutoPulse"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
          <div class="grid gap-3 grid-cols-2">
            <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibAutoPulse" type="checkbox" :disabled="isAxisCenterCalib" />
              自动打点
            </label>
            <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibReturnToStart" type="checkbox" :disabled="isAxisCenterCalib" />
              结束后回起始角
            </label>
          </div>
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
            <label class="flex items-start gap-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibSafetyConfirmed" type="checkbox" :disabled="isAxisCenterCalib" class="mt-1" />
              <span>已确认相机对焦完成、工件固定可靠、激光功率处于安全校准档位。</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">当前阶段</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibPhaseLabel }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">目标旋转轴</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibRotationAxisLabel }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">当前角度</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCurrentAngleText }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">失败信息</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibErrorMessage || '-' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="isAxisCenterCalib"
              @click="handleAxisCenterCalib"
              class="flex-1 rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isAxisCenterCalib ? '校准采样中...' : '开始五轴中心校准' }}
            </button>
            <button
              type="button"
              :disabled="isAxisCenterCalib"
              @click="resetAxisCenterCalibWorkflow"
              class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-4 py-2 text-sm font-medium text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-card) disabled:cursor-not-allowed disabled:opacity-50"
            >
              重置
            </button>
          </div>
          <div class="grid gap-2 lg:grid-cols-5">
            <div
              v-for="position in axisCenterCalibLivePositions"
              :key="position.name"
              class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2"
            >
              <p class="text-xs text-(--app-text-muted)">{{ position.name }} 当前位置</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ position.value }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div
              v-for="sample in axisCenterCalibSamples"
              :key="sample.id"
              class="rounded-xl border p-3"
              :class="getAxisCenterCalibSampleClass(sample.state)"
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
                  <p class="mt-1 text-sm text-(--app-text-primary)">{{ displaySampleAxisPosition(sample, axisName) }}</p>
                </div>
              </div>
              <div class="mt-3 grid gap-2 lg:grid-cols-3">
                <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  人工偏差 X(mm)
                  <input
                    v-model.number="sample.observedOffsetX"
                    type="number"
                    step="any"
                    :disabled="isAxisCenterCalib"
                    class="w-full rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  人工偏差 Y(mm)
                  <input
                    v-model.number="sample.observedOffsetY"
                    type="number"
                    step="any"
                    :disabled="isAxisCenterCalib"
                    class="w-full rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                  />
                </label>
                <div class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  手动记录位置
                  <button
                    type="button"
                    :disabled="!((!isAxisCenterCalib) || axisCenterCalibPendingRecordSampleId === sample.id)"
                    @click="handleManualRecordAxisCenterCalibSample(sample.id)"
                    class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-input-bg) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {{
                      axisCenterCalibPendingRecordSampleId === sample.id
                        ? '标记并继续'
                        : hasSampleMachinePositions(sample)
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
            <div v-if="axisCenterCalibCenterBasedXYSum" class="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">X补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.X.toFixed(3) }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">Y补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.Y.toFixed(3) }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">Z补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.Z.toFixed(3) }}</p>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-(--app-text-muted)">请先完成全部采样点的 XY 位置记录</p>
          </div>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">人工偏差均值 X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.avgX === null ? '-' : axisCenterCalibManualSummary.avgX.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">人工偏差均值 Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.avgY === null ? '-' : axisCenterCalibManualSummary.avgY.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">偏差峰峰值 X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.spanX === null ? '-' : axisCenterCalibManualSummary.spanX.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">偏差峰峰值 Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.spanY === null ? '-' : axisCenterCalibManualSummary.spanY.toFixed(3) }}
              </p>
            </div>
          </div>
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
            <p class="text-xs text-(--app-text-muted)">执行日志</p>
            <div class="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-(--app-text-primary)">
              <p v-for="item in axisCenterCalibLogs" :key="item">{{ item }}</p>
              <p v-if="axisCenterCalibLogs.length === 0" class="text-(--app-text-muted)">尚未开始采样</p>
            </div>
          </div>
        </div>
        <div v-if="activeTab === 'quickFocus'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickFocus"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            设定找焦点
          </button>
          <div
            class="grid gap-3 justify-items-center"
            :style="quickFocusDotGridStyle"
          >
            <span
              v-for="point in quickFocusPoints"
              :key="point.id"
              class="h-2.5 w-2.5 rounded-full ring-1"
              :class="getQuickFocusPointClass(point.state)"
            />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              X/Y 数量
              <input
                v-model.number="quickFocusGridSize"
                type="number"
                min="1"
                step="1"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              step
              <input
                v-model.number="quickFocusStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              Z_step
              <input
                v-model.number="quickFocusZStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
        </div>
        <div v-if="activeTab === 'quickDot'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速打点
          </button>
        </div>
        <div v-if="activeTab === 'quickConcentric'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickConcentric"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速找同心度
          </button>
        </div>
        <div v-if="activeTab === 'userCustom'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            用户自定义
          </button>
        </div>
        <div v-if="activeTab === 'quickMoveToPosition'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleSaveQuickMoveToPosition"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            获取并保存当前位置 XYZ
          </button>
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('X') }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('Y') }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">Z</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('Z') }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </ControlPanelBase>
</template>
