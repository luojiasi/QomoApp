<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { defaultControllerParameters } from '../configs/settings'
import { useControllerSettingsPage } from '../composables/useSettingsPages'
import { useNotification } from '../composables/useNotification'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import type { ControllerAxisCount } from '../types/settings'
import { cloneSettings, formatSettingValue } from '../utils/settings'
import {
  moveAxisAbs,
  moveAxisRel,
  subscribeMotionStatus,
  type MotionStatusSnapshot,
} from '../utils/motionApi'
import { useMotionExecute } from '../utils/motionExecute'

const props = defineProps<{
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const controllerStore = useControllerSettingsStore()
const { sections } = useControllerSettingsPage()
const { success, error } = useNotification()

const axisCountValue = computed(() => controllerStore.controllerSettings.communication.axisCount)

const communicationSection = computed(
  () => sections.value.find((s) => s.id === 'controller-communication') ?? null
)

async function handleAxisCountChange(count: ControllerAxisCount): Promise<void> {
  if (count === axisCountValue.value) return
  await controllerStore.setAxisCount(count)
}

const AXIS_NAMES = ['X', 'Y', 'Z', 'U', 'R'] as const
type AxisName = (typeof AXIS_NAMES)[number]

const axisIndices = computed(() =>
  Array.from({ length: axisCountValue.value }, (_, i) => i)
)

const axisRelativeInputs = ref<number[]>([])
const axisAbsoluteInputs = ref<number[]>([])
const axisMotionPending = ref<Record<number, boolean>>({})

const AXIS_VALUE_MAX_DECIMALS = 4

function roundToMaxDecimals(n: number, decimals = AXIS_VALUE_MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

let unsubscribeMotionStatus: (() => void) | null = null
const latestSnapshot = ref<MotionStatusSnapshot | null>(null)

function getAxisMpos(axisNo: number): number {
  const name = AXIS_NAMES[axisNo]
  const mpos = latestSnapshot.value ? Number(latestSnapshot.value.mposition?.[name]) : NaN
  return Number.isFinite(mpos) ? mpos : NaN
}

function getAxisPositionDisplay(axisNo: number): string {
  const mpos = getAxisMpos(axisNo)
  return Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
}

function formatSettingValueMax4Decimals(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = roundToMaxDecimals(value)
    let s = rounded.toFixed(AXIS_VALUE_MAX_DECIMALS)
    s = s.replace(/\.?0+$/u, '')
    return unit ? `${s} ${unit}` : s
  }
  return formatSettingValue(value as any, unit)
}

onMounted(async () => {
  await controllerStore.loadControllerSettings()
  unsubscribeMotionStatus = subscribeMotionStatus((snapshot) => {
    latestSnapshot.value = snapshot
  }, { autoStart: true, emitLatest: true })
})

onUnmounted(() => {
  unsubscribeMotionStatus?.()
  unsubscribeMotionStatus = null
})

const saving = ref(false)

async function handleSaveToFile(): Promise<void> {
  saving.value = true
  try {
    const payload = cloneSettings(controllerStore.controllerSettings)
    await controllerStore.saveControllerSettings(payload)
    const json = JSON.stringify(controllerStore.controllerSettings, null, 2)
    const res = await window.api.saveJsonToFile('controller-settings', json)
    if (res.ok) { success('已保存', res.filePath); return }
    if ('canceled' in res && res.canceled) return
    error('保存失败', 'error' in res ? res.error : '')
  } finally { saving.value = false }
}

watch(
  axisIndices,
  (indices) => {
    const prevRel = axisRelativeInputs.value
    const prevAbs = axisAbsoluteInputs.value
    axisRelativeInputs.value = indices.map((axisNo) => {
      const v = Number(prevRel[axisNo])
      return Number.isFinite(v) ? v : 1
    })
    axisAbsoluteInputs.value = indices.map((axisNo) => {
      const v = Number(prevAbs[axisNo])
      return Number.isFinite(v) ? v : 0
    })
  },
  { immediate: true }
)

function normalizeAxisManualInput(type: 'rel' | 'abs', axisNo: number): void {
  const target = type === 'rel' ? axisRelativeInputs.value : axisAbsoluteInputs.value
  const v = Number(target[axisNo])
  if (!Number.isFinite(v)) return
  target[axisNo] = roundToMaxDecimals(v)
}

function isAxisMotionBusy(axisNo: number): boolean {
  return Boolean(axisMotionPending.value[axisNo])
}

function setAxisMotionBusy(axisNo: number, busy: boolean): void {
  axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: busy }
}

function getManualPlaceholder(axisNo: number, mode: 'rel' | 'abs'): string {
  const name = AXIS_NAMES[axisNo]
  if (name === 'U' || name === 'R') return mode === 'rel' ? '旋转增量(°)' : '旋转位置(°)'
  return mode === 'rel' ? '相对位移(mm)' : '绝对位置(mm)'
}

function getActionLabel(axisNo: number): string {
  const name = AXIS_NAMES[axisNo]
  if (name === 'U' || name === 'R') return `${name}轴旋转`
  return `${name}轴运动`
}

async function handleAxisRelativeMove(axisNo: number): Promise<void> {
  const value = Number(axisRelativeInputs.value[axisNo])
  if (!Number.isFinite(value) || value === 0) {
    error(`轴 ${axisNo} 输入无效`, '请输入非 0 的数值')
    return
  }
  setAxisMotionBusy(axisNo, true)
  try {
    const axisName = AXIS_NAMES[axisNo]
    const res = await moveAxisRel(axisName as AxisName, value)
    if (!res?.success) { error(`${axisName}轴相对运动失败`, res?.message ?? ''); return }
    success(`${axisName}轴相对运动已下发`, `位移: ${roundToMaxDecimals(value)}`)
  } finally { setAxisMotionBusy(axisNo, false) }
}

async function handleAxisAbsoluteMove(axisNo: number): Promise<void> {
  const value = Number(axisAbsoluteInputs.value[axisNo])
  if (!Number.isFinite(value)) {
    error(`轴 ${axisNo} 输入无效`, '请输入有效数值')
    return
  }
  setAxisMotionBusy(axisNo, true)
  try {
    const axisName = AXIS_NAMES[axisNo]
    const res = await moveAxisAbs(axisName as AxisName, value)
    if (!res?.success) { error(`${axisName}轴绝对运动失败`, res?.message ?? ''); return }
    success(`${axisName}轴绝对运动已下发`, `目标: ${roundToMaxDecimals(value)}`)
  } finally { setAxisMotionBusy(axisNo, false) }
}

const {
  onlineCommandInput,
  onlineCommandResult,
  onlineCommandPending,
  commonOnlineCommands,
  selectedCommonOnlineCommand,
  applyCommonOnlineCommand,
  handleSendOnlineCommand,
  handleOpenOnlineCommandDoc
} = useMotionExecute({ success, error })
</script>

<template>
  <div :class="props.embedded ? 'app-page min-h-0 px-4 py-4' : 'app-page min-h-screen px-6 py-10'">
    <div v-if="!props.embedded" class="mx-auto max-w-7xl space-y-6">
      <div class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">控制器参数设置</h1>
          </div>
          <RouterLink
            to="/home"
            class="app-card-soft app-text-primary rounded-xl border border-(--app-border) px-5 py-3 text-center font-medium transition hover:bg-(--app-card)"
          >
            返回首页
          </RouterLink>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="app-card rounded-2xl p-5 text-center shadow-sm">
          <p class="app-text-secondary text-sm">控制器型号</p>
          <p class="app-text-primary mt-2 text-2xl font-semibold">
            {{ controllerStore.controllerSettings.communication.controllerModel }}
          </p>
        </div>

        <div class="app-card rounded-2xl p-5 text-center shadow-sm">
          <p class="app-text-secondary text-sm">轴数量</p>
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            <button
              v-for="n in ([3, 5] as const)"
              :key="n"
              type="button"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              :class="
                axisCountValue === n
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'app-card-soft border-transparent hover:border-(--app-border)'
              "
              @click="handleAxisCountChange(n)"
            >
              {{ n === 3 ? '3 轴（XYZ）' : '5 轴（XYZUR）' }}
            </button>
          </div>
        </div>

        <div class="app-card rounded-2xl p-5 shadow-sm md:col-span-2">
          <div class="flex items-center justify-between gap-2">
            <p class="app-text-primary text-sm font-semibold">在线命令</p>
          </div>
          <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div class="grid gap-3 md:grid-cols-[1fr_120px]">
                <input
                  v-model.trim="onlineCommandInput"
                  type="text"
                  class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                  placeholder="请输入在线命令，例如：?*set"
                />
                <button
                  type="button"
                  class="rounded-lg border border-blue-500/40 bg-blue-600/85 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                  :disabled="onlineCommandPending"
                  @click="handleSendOnlineCommand"
                >
                  {{ onlineCommandPending ? '发送中...' : '发送命令' }}
                </button>
              </div>
              <div class="mt-3">
                <label class="app-text-secondary mb-1 block text-xs">返回结果（只读）</label>
                <textarea
                  :value="onlineCommandResult"
                  readonly
                  rows="8"
                  class="app-text-primary w-full resize-none rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs opacity-90 outline-none"
                  placeholder="命令返回信息"
                />
                <p class="app-text-muted mt-2 text-[13px] leading-5">
                  {{ selectedCommonOnlineCommand
                    ? `${selectedCommonOnlineCommand.description}。${selectedCommonOnlineCommand.usage}`
                    : '功能描述：在线命令用于调试控制器指令下发与回读结果。点击右侧任一常用命令后，此处将展示该命令对应的功能说明。'
                  }}
                </p>
              </div>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-card-soft) p-3">
              <div class="flex items-center justify-between gap-2">
                <p class="app-text-secondary text-xs font-medium">常用命令</p>
                <button
                  type="button"
                  class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] transition hover:border-blue-500/50 hover:bg-blue-500/10"
                  @click="handleOpenOnlineCommandDoc"
                >
                  打开文档
                </button>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                <button
                  v-for="cmd in commonOnlineCommands"
                  :key="cmd.command"
                  type="button"
                  class="app-text-primary rounded-lg border px-2 py-1.5 text-left text-xs transition"
                  :class="
                    selectedCommonOnlineCommand?.command === cmd.command
                      ? 'border-blue-500/60 bg-blue-500/15'
                      : 'border-(--app-border) bg-(--app-input-bg) hover:border-blue-500/50 hover:bg-blue-500/10'
                  "
                  @click="applyCommonOnlineCommand(cmd)"
                >
                  <p class="font-medium">{{ cmd.description }}</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 通讯参数 -->
      <section v-if="communicationSection" class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">{{ communicationSection.title }}</h2>
        <p class="app-text-secondary mt-2 text-sm">{{ communicationSection.description }}</p>
        <div class="mt-5 flex flex-wrap items-stretch gap-3">
          <div
            v-for="field in communicationSection.fields"
            :key="field.key"
            class="app-card-soft min-w-40 flex-1 rounded-xl p-4"
          >
            <p class="app-text-secondary text-xs">{{ field.label }}</p>
            <p class="app-text-primary mt-2 text-base font-medium break-all">
              {{ formatSettingValue(field.value, field.unit) }}
            </p>
          </div>
        </div>
      </section>

      <!-- 轴位置回读（WS 实时数据） -->
      <section class="app-card rounded-2xl p-6 shadow-sm">
        <div class="flex flex-wrap items-center gap-3 border-b border-(--app-border) pb-4">
          <h2 class="app-text-primary shrink-0 text-xl font-semibold">轴状态</h2>
          <div class="ml-auto flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
              :disabled="saving"
              @click="handleSaveToFile"
            >
              保存
            </button>
          </div>
        </div>
        <p class="app-text-muted mt-3 text-xs">
          轴参数已交由后端配置文件 <code class="rounded bg-(--app-card-soft) px-1 py-0.5">motion_config.json</code> 管理。下方为实时位置回读。
        </p>
        <div class="mt-4 grid grid-cols-5 gap-3">
          <div
            v-for="axisIdx in axisIndices"
            :key="axisIdx"
            class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-2 text-center"
          >
            <p class="text-xs text-(--app-text-muted)">轴{{ axisIdx }} {{ AXIS_NAMES[axisIdx] }}</p>
            <p class="mt-1 text-lg font-semibold text-(--app-text-primary)">
              {{ getAxisPositionDisplay(axisIdx) }}
            </p>
            <p class="text-[10px] text-(--app-text-muted)">mpos</p>
          </div>
        </div>

        <!-- 手动运动 -->
        <div class="mt-5 rounded-xl border border-(--app-border) bg-(--app-card-soft) p-4">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="app-text-primary text-sm font-semibold">手动运动（相对/绝对）</h3>
            <p class="app-text-muted text-xs">单位: X/Y/Z(mm) U/R(°)</p>
          </div>
          <div class="mt-3 grid gap-3">
            <div
              v-for="axisIdx in axisIndices"
              :key="`manual-move-${axisIdx}`"
              class="grid gap-2 rounded-lg border border-(--app-border) p-3 md:grid-cols-[90px_1fr_120px_1fr_120px]"
            >
              <div class="app-text-primary text-sm font-medium">
                轴{{ axisIdx }} {{ AXIS_NAMES[axisIdx] }}
              </div>
              <input
                v-model.number="axisRelativeInputs[axisIdx]"
                type="number"
                :step="0.0001"
                :disabled="isAxisMotionBusy(axisIdx)"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1.5 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 disabled:opacity-60"
                :placeholder="getManualPlaceholder(axisIdx, 'rel')"
                @blur="normalizeAxisManualInput('rel', axisIdx)"
              />
              <button
                type="button"
                class="rounded-lg border border-blue-500/40 bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="isAxisMotionBusy(axisIdx)"
                @click="handleAxisRelativeMove(axisIdx)"
              >
                {{ getActionLabel(axisIdx) }}相对
              </button>
              <input
                v-model.number="axisAbsoluteInputs[axisIdx]"
                type="number"
                :step="0.0001"
                :disabled="isAxisMotionBusy(axisIdx)"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1.5 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 disabled:opacity-60"
                :placeholder="getManualPlaceholder(axisIdx, 'abs')"
                @blur="normalizeAxisManualInput('abs', axisIdx)"
              />
              <button
                type="button"
                class="rounded-lg border border-indigo-500/40 bg-indigo-600/85 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
                :disabled="isAxisMotionBusy(axisIdx)"
                @click="handleAxisAbsoluteMove(axisIdx)"
              >
                {{ getActionLabel(axisIdx) }}绝对
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 嵌入式面板视图 -->
    <div v-else class="mx-auto max-w-7xl space-y-6">
      <div class="space-y-6">
        <section class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex flex-wrap items-center gap-3 border-b border-(--app-border) pb-4">
            <h2 class="app-text-primary shrink-0 text-xl font-semibold">轴状态</h2>
            <div class="ml-auto flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-(--app-border) app-card-soft px-3 py-2 text-sm font-medium transition hover:bg-(--app-card)"
                @click="emit('back')"
              >
                关闭面板
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToFile"
              >
                保存
              </button>
            </div>
          </div>
          <p class="app-text-muted mt-3 text-xs">
            轴参数已交由后端配置文件 <code class="rounded bg-(--app-card-soft) px-1 py-0.5">motion_config.json</code> 管理。下方为实时位置回读。
          </p>
          <div class="mt-4 grid grid-cols-5 gap-3">
            <div
              v-for="axisIdx in axisIndices"
              :key="axisIdx"
              class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-2 text-center"
            >
              <p class="text-xs text-(--app-text-muted)">轴{{ axisIdx }} {{ AXIS_NAMES[axisIdx] }}</p>
              <p class="mt-1 text-lg font-semibold text-(--app-text-primary)">
                {{ getAxisPositionDisplay(axisIdx) }}
              </p>
              <p class="text-[10px] text-(--app-text-muted)">mpos</p>
            </div>
          </div>

          <div class="mt-5 rounded-xl border border-(--app-border) bg-(--app-card-soft) p-4">
            <div class="flex items-baseline justify-between gap-2">
              <h3 class="app-text-primary text-sm font-semibold">手动运动（相对/绝对）</h3>
              <p class="app-text-muted text-xs">单位: X/Y/Z(mm) U/R(°)</p>
            </div>
            <div class="mt-3 grid gap-3">
              <div
                v-for="axisIdx in axisIndices"
                :key="`manual-move-embedded-${axisIdx}`"
                class="grid gap-2 rounded-lg border border-(--app-border) p-3 md:grid-cols-[90px_1fr_120px_1fr_120px]"
              >
                <div class="app-text-primary text-sm font-medium">
                  轴{{ axisIdx }} {{ AXIS_NAMES[axisIdx] }}
                </div>
                <input
                  v-model.number="axisRelativeInputs[axisIdx]"
                  type="number"
                  :step="0.0001"
                  :disabled="isAxisMotionBusy(axisIdx)"
                  class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1.5 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 disabled:opacity-60"
                  :placeholder="getManualPlaceholder(axisIdx, 'rel')"
                  @blur="normalizeAxisManualInput('rel', axisIdx)"
                />
                <button
                  type="button"
                  class="rounded-lg border border-blue-500/40 bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                  :disabled="isAxisMotionBusy(axisIdx)"
                  @click="handleAxisRelativeMove(axisIdx)"
                >
                  {{ getActionLabel(axisIdx) }}相对
                </button>
                <input
                  v-model.number="axisAbsoluteInputs[axisIdx]"
                  type="number"
                  :step="0.0001"
                  :disabled="isAxisMotionBusy(axisIdx)"
                  class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1.5 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 disabled:opacity-60"
                  :placeholder="getManualPlaceholder(axisIdx, 'abs')"
                  @blur="normalizeAxisManualInput('abs', axisIdx)"
                />
                <button
                  type="button"
                  class="rounded-lg border border-indigo-500/40 bg-indigo-600/85 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
                  :disabled="isAxisMotionBusy(axisIdx)"
                  @click="handleAxisAbsoluteMove(axisIdx)"
                >
                  {{ getActionLabel(axisIdx) }}绝对
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
