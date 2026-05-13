<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AXIS_TAB_LABELS, defaultControllerParameters } from '../../configs/settings'
import { IO_MAP_GROUP_COUNT } from '@/shared/constants'
import { useControllerSettingsPage } from '../../composables/useSettingsPages'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../../stores/controllerSettingsStore'
import ApiTestPanel from './ApiTestPanel.vue'
import type {
  ControllerAxisCount,
  ControllerAxisUserInput,
  ParameterField
} from '../../types/settings'
import { cloneSettings, formatSettingValue } from '../../utils/settings'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  connectMotionWithControllerSettings,
  emergencyStopMotion,
  zeroMotionAxis
} from '../../api/motion'
import { setMotionIoOutput } from '../../api/motion/io'
import { useMotionExecute } from '../../api/motion'
import { useHardwareState } from '@/shared/api/hardware'

const props = defineProps<{
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const controllerStore = useControllerSettingsStore()
const { sections } = useControllerSettingsPage()
const { success, error, info } = useNotification()
const { ioIn: wsIoIn, ioOut: wsIoOut, position: wsPosition, mposition: wsMposition } = useHardwareState()

// =========================================================================
// 字段寻址辅助
// =========================================================================

const USER_AXIS_KEYS = [
  'axis_no', 'axis_name', 'axis_type', 'units', 'speed', 'lspeed',
  'creep', 'accel', 'decel', 'merge', 'sramp',
  'fwd_in', 'rev_in', 'backlash', 'backlash_enable'
] as const satisfies readonly (keyof ControllerAxisUserInput)[]

const MERGE_PARAM_KEYS = ['corner_mode', 'decel_angle', 'stop_angle', 'zxmooth'] as const
type MergeParamKey = (typeof MERGE_PARAM_KEYS)[number]

function isMergeParamField(field: ParameterField): boolean {
  return (MERGE_PARAM_KEYS as readonly string[]).includes(field.key)
}
function mergeParamKey(field: ParameterField): MergeParamKey {
  return field.key as MergeParamKey
}
function userNumberKey(field: ParameterField): keyof Omit<ControllerAxisUserInput, 'axis_name' | 'merge_params'> {
  return field.key as keyof Omit<ControllerAxisUserInput, 'axis_name' | 'merge_params'>
}
function isBacklashEnableField(field: ParameterField): boolean {
  return field.key === 'backlash_enable'
}

// =========================================================================
// 轴数量
// =========================================================================

const axisCountValue = computed(() => controllerStore.controllerSettings.communication.axis_count)
const axisTabLabels = computed(() => AXIS_TAB_LABELS[axisCountValue.value])

async function handleAxisCountChange(count: ControllerAxisCount): Promise<void> {
  if (count === axisCountValue.value) return
  await controllerStore.setAxisCount(count)
}

// =========================================================================
// 轴参数表格
// =========================================================================

const axisIndices = computed(() => Array.from({ length: axisCountValue.value }, (_, i) => i))

const writeFields = computed(() => {
  const section = sections.value.find((s) => s.id.endsWith('-input'))
  return section?.fields.filter(
    (f) => f.key !== 'axis_no' && f.key !== 'axis_name'
  ) ?? []
})

// =========================================================================
// 数值工具
// =========================================================================

const MAX_DECIMALS = 4

function roundMax(n: number, decimals = MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

function fmtVal(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number' && Number.isFinite(value)) {
    let s = roundMax(value).toFixed(MAX_DECIMALS)
    s = s.replace(/\.?0+$/u, '')
    return unit ? `${s} ${unit}` : s
  }
  return formatSettingValue(value as any, unit)
}

function normalizeAxisInput(axisIdx: number, fieldKey: string): void {
  const ax = controllerStore.controllerSettings.axes[axisIdx] as any
  if (!ax) return
  if ((MERGE_PARAM_KEYS as readonly string[]).includes(fieldKey)) {
    const v = Number(ax.merge_params?.[fieldKey])
    if (!Number.isFinite(v)) return
    ax.merge_params[fieldKey] = roundMax(v)
    return
  }
  const v = Number(ax[fieldKey])
  if (!Number.isFinite(v)) return
  ax[fieldKey] = roundMax(v)
}

// =========================================================================
// 保存 / 重置
// =========================================================================

onMounted(async () => {
  await controllerStore.loadControllerSettings()
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

function resetAllAxes(): void {
  const axes = controllerStore.controllerSettings.axes
  for (let i = 0; i < axes.length; i++) {
    const ax = axes[i]
    const def = defaultControllerParameters.axes[i]
    for (const k of USER_AXIS_KEYS) {
      ;(ax as unknown as Record<string, unknown>)[k] = def[k]
    }
    ax.merge_params = { ...def.merge_params }
  }
  success('已重置', '所有轴已恢复为默认值')
}

// =========================================================================
// 连接 & 急停 & 归零
// =========================================================================

const connecting = ref(false)
const connected = ref(false)

async function handleConnect(): Promise<void> {
  if (connecting.value) return
  connecting.value = true
  try {
    const res = await connectMotionWithControllerSettings(controllerStore.controllerSettings)
    if (res?.success) {
      connected.value = true
      success('已连接', `控制器 ${controllerStore.controllerSettings.communication.controller_ip}`)
    } else {
      error('连接失败', res?.message ?? '无法连接控制器')
    }
  } catch (e: any) {
    error('连接异常', e?.message ?? '')
  } finally { connecting.value = false }
}

const stopping = ref(false)

async function handleEmergencyStop(): Promise<void> {
  if (stopping.value) return
  stopping.value = true
  try {
    const res = await emergencyStopMotion()
    if (res?.success) { success('急停成功', '所有轴已紧急停止') }
    else { error('急停失败', res?.message ?? '') }
  } catch (e: any) { error('急停异常', e?.message ?? '') }
  finally { stopping.value = false }
}

const zeroingAxis = ref<Record<number, boolean>>({})

async function handleZeroAxis(axisNo: number): Promise<void> {
  if (zeroingAxis.value[axisNo]) return
  zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: true }
  try {
    const res = await zeroMotionAxis(axisNo)
    if (res?.success) { success(`轴 ${axisNo} 归零`, '归零指令已下发') }
    else { error('归零失败', res?.message ?? '') }
  } catch (e: any) { error('归零异常', e?.message ?? '') }
  finally { zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: false } }
}

// =========================================================================
// IO 控制 — 输入/输出状态由 WebSocket 实时推送驱动
// =========================================================================

const ioOutputs = computed(() => {
  const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
  for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
    arr[i] = Boolean(wsIoOut.value[String(i)])
  }
  return arr
})
const ioInputs = computed(() => {
  const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
  for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
    arr[i] = Boolean(wsIoIn.value[String(i)])
  }
  return arr
})

const togglingIo = ref<Record<number, boolean>>({})

const axisNames = ['X', 'Y', 'Z', 'U', 'R'] as const

async function handleIoOutputToggle(ioNo: number): Promise<void> {
  if (togglingIo.value[ioNo]) return
  togglingIo.value = { ...togglingIo.value, [ioNo]: true }
  const nextValue = !ioOutputs.value[ioNo]
  try {
    const res = await setMotionIoOutput(ioNo, nextValue)
    if (res?.success) {
      info(`IO 输出 ${ioNo}`, nextValue ? '已开启' : '已关闭')
      // 状态由下一帧 WS 推送确认，不手动乐观更新
    } else {
      error(`IO 输出 ${ioNo} 失败`, res?.message ?? '')
    }
  } catch (e: any) { error(`IO 输出 ${ioNo} 异常`, e?.message ?? '') }
  finally { togglingIo.value = { ...togglingIo.value, [ioNo]: false } }
}

// =========================================================================
// 手动运动
// =========================================================================

const U_AXIS_NO = 3
const R_AXIS_NO = 4

const axisRelativeInputs = ref<number[]>([])
const axisAbsoluteInputs = ref<number[]>([])
const axisMotionPending = ref<Record<number, boolean>>({})

watch(axisIndices, (indices) => {
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
}, { immediate: true })

function normalizeManualInput(type: 'rel' | 'abs', axisNo: number): void {
  const target = type === 'rel' ? axisRelativeInputs.value : axisAbsoluteInputs.value
  const v = Number(target[axisNo])
  if (!Number.isFinite(v)) return
  target[axisNo] = roundMax(v)
}

function isBusy(axisNo: number): boolean {
  return Boolean(axisMotionPending.value[axisNo])
}
function setBusy(axisNo: number, busy: boolean): void {
  axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: busy }
}

function isU(axisNo: number): boolean { return axisCountValue.value === 5 && axisNo === U_AXIS_NO }
function isR(axisNo: number): boolean { return axisCountValue.value === 5 && axisNo === R_AXIS_NO }

function relPlaceholder(axisNo: number): string {
  if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
  if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
  return '相对位移(mm)'
}
function relLabel(axisNo: number): string {
  if (isU(axisNo)) return 'U轴旋转'
  if (isR(axisNo)) return 'R轴旋转'
  return '相对运动'
}
function absPlaceholder(axisNo: number): string {
  if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
  if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
  return '绝对位置(mm)'
}
function absLabel(axisNo: number): string {
  if (isU(axisNo)) return 'U轴旋转'
  if (isR(axisNo)) return 'R轴旋转'
  return '绝对运动'
}
function axisSpeed(axisNo: number): number {
  const v = Number(controllerStore.controllerSettings.axes[axisNo]?.speed)
  return Number.isFinite(v) && v > 0 ? v : 20
}

async function handleRelativeMove(axisNo: number): Promise<void> {
  const value = Number(axisRelativeInputs.value[axisNo])
  if (!Number.isFinite(value) || value === 0) {
    error(`轴 ${axisNo} 输入无效`, '请输入非 0 的数值')
    return
  }
  setBusy(axisNo, true)
  try {
    const dir = value >= 0 ? '顺时针' : '逆时针'
    const absV = Math.abs(value)

    if (isU(axisNo)) {
      const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
      if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
      success('U轴旋转已下发', `角度: ${roundMax(absV)}°，方向: ${dir}`)
      return
    }
    if (isR(axisNo)) {
      const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
      if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
      success('R轴旋转已下发', `圈数: ${roundMax(absV)} 圈，方向: ${dir}`)
      return
    }
    const res = await moveMotionAxisRel(axisNo, value, { controllerSettings: controllerStore.controllerSettings })
    if (!res?.success) { error(`轴 ${axisNo} 相对运动失败`, res?.message ?? ''); return }
    success(`轴 ${axisNo} 相对运动已下发`, `位移: ${roundMax(value)} mm`)
  } finally { setBusy(axisNo, false) }
}

async function handleAbsoluteMove(axisNo: number): Promise<void> {
  const inputValue = Number(axisAbsoluteInputs.value[axisNo])
  if (!Number.isFinite(inputValue)) { error(`轴 ${axisNo} 输入无效`, '请输入有效数值'); return }
  setBusy(axisNo, true)
  try {
    const dir = inputValue >= 0 ? '顺时针' : '逆时针'
    const absV = Math.abs(inputValue)

    if (isU(axisNo)) {
      const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
      if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
      success('U轴旋转已下发', `角度: ${roundMax(absV)}°，方向: ${dir}`)
      return
    }
    if (isR(axisNo)) {
      const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
      if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
      success('R轴旋转已下发', `圈数: ${roundMax(absV)} 圈，方向: ${dir}`)
      return
    }
    const res = await moveMotionAxisAbs(axisNo, inputValue, { controllerSettings: controllerStore.controllerSettings })
    if (!res?.success) { error(`轴 ${axisNo} 绝对运动失败`, res?.message ?? ''); return }
    success(`轴 ${axisNo} 绝对运动已下发`, `目标: ${roundMax(inputValue)} mm`)
  } finally { setBusy(axisNo, false) }
}

// =========================================================================
// 在线命令
// =========================================================================

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
    <!-- ================================================================
         非嵌入模式（独立页面）
         ================================================================ -->
    <div v-if="!props.embedded" class="mx-auto max-w-7xl space-y-5">

      <!-- 标题栏 -->
      <div class="app-card rounded-2xl p-6 shadow-lg">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold app-text-primary">控制器参数设置</h1>
            <p class="mt-1 text-sm app-text-muted">通讯、轴参数、I/O 与手动运动调试</p>
          </div>
          <div class="flex gap-2">
            <RouterLink
              to="/home"
              class="rounded-xl border border-(--app-border) px-4 py-2.5 text-sm font-medium app-text-primary transition hover:bg-(--app-card)"
            >
              返回首页
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- 通讯 + 控制栏 -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- 控制器信息 -->
        <div class="app-card rounded-2xl p-5 shadow-sm lg:col-span-2">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-xs app-text-muted">控制器型号</p>
              <p class="mt-1 text-xl font-semibold app-text-primary">
                {{ controllerStore.controllerSettings.communication.controller_model }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs app-text-muted">IP 地址</p>
              <input
                v-model="controllerStore.controllerSettings.communication.controller_ip"
                type="text"
                class="mt-1 w-44 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-1.5 text-sm text-center app-text-primary outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </div>
            <div class="text-right">
              <p class="text-xs app-text-muted">连接超时(秒)</p>
              <input
                v-model.number="controllerStore.controllerSettings.communication.connect_timeout_s"
                type="number"
                step="0.5"
                min="1"
                class="mt-1 w-20 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-1.5 text-sm text-center app-text-primary outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-(--app-border) pt-4">
            <button
              type="button"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              :class="connected
                ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                : 'border-blue-500/50 bg-blue-600/90 text-white hover:bg-blue-600'"
              :disabled="connecting"
              @click="handleConnect"
            >
              {{ connecting ? '连接中...' : connected ? '已连接' : '连接控制器' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-900/50 disabled:opacity-50"
              :disabled="stopping"
              @click="handleEmergencyStop"
            >
              {{ stopping ? '急停中...' : '急停' }}
            </button>
            <span v-if="connected" class="ml-auto flex items-center gap-1.5 text-xs text-emerald-600">
              <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              已连接
            </span>
            <span v-else class="ml-auto flex items-center gap-1.5 text-xs app-text-muted">
              <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
              未连接
            </span>
          </div>
        </div>

        <!-- 轴数量切换 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <p class="text-xs app-text-muted">轴数量</p>
          <div class="mt-3 flex gap-2">
            <button
              v-for="n in ([3, 5] as const)"
              :key="n"
              type="button"
              class="flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors"
              :class="axisCountValue === n
                ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                : 'app-card-soft border-transparent hover:border-(--app-border)'"
              @click="handleAxisCountChange(n)"
            >
              {{ n === 3 ? '3 轴 (XYZ)' : '5 轴 (XYZUR)' }}
            </button>
          </div>
          <p class="mt-2 text-xs app-text-muted">
            当前: {{ axisTabLabels.join(' / ') }}
          </p>
        </div>
      </div>

      <!-- 轴实时位置（WS 推送） -->
      <div class="app-card rounded-2xl p-4 shadow-sm">
        <h3 class="text-sm font-semibold app-text-primary mb-2">
          轴位置
          <span class="ml-2 text-xs font-normal app-text-muted">
            指令(dpos) / 实际(mpos)
          </span>
        </h3>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="axisIdx in axisIndices"
            :key="`pos-${axisIdx}`"
            class="min-w-[120px] flex-1 rounded-lg border border-(--app-border) bg-(--app-card-soft) px-4 py-3 text-center"
          >
            <p class="text-xs font-semibold app-text-primary">
              轴{{ axisIdx }} <span class="font-normal opacity-50">{{ axisNames[axisIdx] }}</span>
            </p>
            <p class="mt-1 text-lg font-mono app-text-primary">
              {{ fmtVal(wsPosition[axisNames[axisIdx]]) }}
            </p>
            <p class="text-[11px] app-text-muted">
              mpos: {{ fmtVal(wsMposition[axisNames[axisIdx]]) }}
            </p>
          </div>
        </div>
      </div>

      <!-- IO 状态栏 -->
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- IO 输出 -->
        <div class="app-card rounded-2xl p-4 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold app-text-primary">
              I/O 数字量输出（可控制）
            </h3>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="(val, i) in ioOutputs"
              :key="`io-out-${i}`"
              type="button"
              class="min-w-[48px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
              :class="val
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-700'
                : 'border-(--app-border) bg-(--app-card-soft) app-text-muted hover:border-sky-400/50'"
              :disabled="Boolean(togglingIo[i])"
              @click="handleIoOutputToggle(i)"
            >
              {{ val ? 'ON' : 'OFF' }}<span class="ml-0.5 opacity-60">{{ i }}</span>
            </button>
          </div>
        </div>

        <!-- IO 输入 -->
        <div class="app-card rounded-2xl p-4 shadow-sm">
          <h3 class="text-sm font-semibold app-text-primary">I/O 数字量输入（只读）</h3>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="(val, i) in ioInputs"
              :key="`io-in-${i}`"
              class="min-w-[48px] rounded-lg border px-2.5 py-1.5 text-xs font-medium"
              :class="val
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-700'
                : 'border-(--app-border) bg-(--app-card-soft) app-text-muted'"
            >
              {{ val ? 'ON' : 'OFF' }}<span class="ml-0.5 opacity-60">{{ i }}</span>
            </span>
          </div>
        </div>
      </div>

      

      <!-- 轴参数 + 手动运动 -->
      <section class="space-y-5">
        <!-- 手动运动卡片 -->
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
              <!-- 轴标签 -->
              <span class="w-16 text-sm font-semibold app-text-primary shrink-0">
                轴{{ axisIdx }} <span class="text-xs font-normal opacity-60">{{ axisTabLabels[axisIdx] }}</span>
              </span>

              <!-- 归零 -->
              <button
                type="button"
                class="rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-900/40 disabled:opacity-50"
                :disabled="Boolean(zeroingAxis[axisIdx]) || isBusy(axisIdx)"
                @click="handleZeroAxis(axisIdx)"
              >
                {{ zeroingAxis[axisIdx] ? '...' : '归零' }}
              </button>

              <!-- 相对运动 -->
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

              <!-- 绝对运动 -->
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


        <!-- 轴参数卡片 -->
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 border-b border-(--app-border) pb-3">
            <div class="ml-auto flex shrink-0 gap-2">
              <button
                type="button"
                class="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetAllAxes"
              >
                重置全部轴
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToFile"
              >
                {{ saving ? '保存中...' : '保存到文件' }}
              </button>
            </div>
          </div>

          <!-- 可配置（写入）表格 -->
          <div class="mt-4 overflow-x-auto">
            <table class="w-full border border-(--app-border) border-collapse text-xs">
              <thead>
                <tr class="bg-rose-950/10 border-b border-(--app-border)">
                  <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2.5 text-left font-semibold app-text-secondary">
                    参数
                  </th>
                  <th
                    v-for="axisIdx in axisIndices"
                    :key="`write-h-${axisIdx}`"
                    class="px-3 py-2.5 text-center font-semibold app-text-secondary min-w-[80px]"
                  >
                    轴{{ axisIdx }}
                    <span class="block text-[10px] font-normal app-text-muted">{{ axisTabLabels[axisIdx] }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in writeFields"
                  :key="`write-${field.key}`"
                  class="border-b border-(--app-border) hover:bg-(--app-card-soft)/50"
                >
                  <td class="sticky left-0 z-5 bg-(--app-card) px-3 py-1.5 font-medium app-text-secondary">
                    {{ field.label }}
                  </td>
                  <td
                    v-for="axisIdx in axisIndices"
                    :key="`write-${field.key}-${axisIdx}`"
                    class="px-3 py-1"
                  >
                    <!-- 轴名称：文本 -->
                    <input
                      v-if="field.key === 'axis_name'"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].axis_name"
                      type="text"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    />
                    <!-- backlash_enable：下拉 -->
                    <select
                      v-else-if="isBacklashEnableField(field)"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].backlash_enable"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    >
                      <option :value="false">否</option>
                      <option :value="true">是</option>
                    </select>
                    <!-- merge_params 子字段 -->
                    <input
                      v-else-if="isMergeParamField(field)"
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx].merge_params[mergeParamKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                    <!-- 通用数值 -->
                    <input
                      v-else
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <!-- 在线命令卡片 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-semibold app-text-primary mb-3">在线命令</h3>
          <div class="grid gap-3 lg:grid-cols-[1fr_240px]">
            <div>
              <div class="flex gap-2">
                <input
                  v-model.trim="onlineCommandInput"
                  type="text"
                  class="flex-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs font-mono outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                  placeholder="例如：?*set 或 VMOVE(1) AXIS(0)"
                  @keyup.enter="handleSendOnlineCommand"
                />
                <button
                  type="button"
                  class="rounded-lg border border-blue-500/40 bg-blue-600/85 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                  :disabled="onlineCommandPending"
                  @click="handleSendOnlineCommand"
                >
                  {{ onlineCommandPending ? '发送中...' : '发送' }}
                </button>
              </div>
              <textarea
                :value="onlineCommandResult"
                readonly
                rows="5"
                class="mt-2 w-full resize-none rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs font-mono opacity-90 outline-none app-text-primary"
                placeholder="命令返回信息将显示在这里..."
              />
              <p class="mt-1 text-[11px] app-text-muted leading-relaxed">
                {{ selectedCommonOnlineCommand ? `${selectedCommonOnlineCommand.description} — ${selectedCommonOnlineCommand.usage}` : '选择一个常用命令查看用法说明，或直接输入 ZMC 指令后按 Enter 发送。' }}
              </p>
            </div>

            <div class="rounded-lg border border-(--app-border) bg-(--app-card-soft) p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-xs font-medium app-text-muted">常用命令</span>
                <button
                  type="button"
                  class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-0.5 text-[10px] transition hover:border-blue-500/50 hover:bg-blue-500/10"
                  @click="handleOpenOnlineCommandDoc"
                >
                  文档
                </button>
              </div>
              <div class="space-y-1">
                <button
                  v-for="cmd in commonOnlineCommands"
                  :key="cmd.command"
                  type="button"
                  class="w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-tight transition"
                  :class="selectedCommonOnlineCommand?.command === cmd.command
                    ? 'border-blue-500/60 bg-blue-500/15 app-text-primary'
                    : 'border-transparent bg-(--app-input-bg) app-text-muted hover:border-blue-500/50 hover:bg-blue-500/10'"
                  @click="applyCommonOnlineCommand(cmd)"
                >
                  {{ cmd.description }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- API 测试面板 -->
      <ApiTestPanel />
    </div>

    <!-- ================================================================
         嵌入模式（Home 右侧面板）
         ================================================================ -->
    <div v-else class="mx-auto max-w-7xl space-y-4">
      <section class="space-y-4">
        <!-- 轴参数卡片 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 border-b border-(--app-border) pb-3 mb-3">
            <div class="ml-auto flex gap-1.5">
              <button
                type="button"
                class="rounded-md border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetAllAxes"
              >
                重置全部轴
              </button>
              <button
                type="button"
                class="rounded-md border border-(--app-border) app-card-soft px-2.5 py-1 text-[11px] font-medium transition hover:bg-(--app-card)"
                @click="emit('back')"
              >
                关闭
              </button>
              <button
                type="button"
                class="rounded-md border border-blue-500/50 bg-blue-600/90 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToFile"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>

          <!-- 可配置（写入）表格（嵌入模式也用可编辑 input） -->
          <div class="overflow-x-auto">
            <table class="w-full border border-(--app-border) border-collapse text-[11px]">
              <thead>
                <tr class="bg-rose-950/10 border-b border-(--app-border)">
                  <th class="sticky left-0 z-10 bg-rose-950/10 px-2 py-1.5 text-left font-semibold app-text-secondary">参数</th>
                  <th
                    v-for="axisIdx in axisIndices"
                    :key="`e-w-h-${axisIdx}`"
                    class="px-2 py-1.5 text-center font-semibold app-text-secondary"
                  >
                    轴{{ axisIdx }}
                    <span class="block text-[9px] font-normal app-text-muted">{{ axisTabLabels[axisIdx] }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in writeFields"
                  :key="`e-w-${field.key}`"
                  class="border-b border-(--app-border) hover:bg-(--app-card-soft)/50"
                >
                  <td class="sticky left-0 z-5 bg-(--app-card) px-2 py-1 font-medium app-text-secondary">{{ field.label }}</td>
                  <td
                    v-for="axisIdx in axisIndices"
                    :key="`e-w-${field.key}-${axisIdx}`"
                    class="px-2 py-1"
                  >
                    <!-- 轴名称：文本 -->
                    <input
                      v-if="field.key === 'axis_name'"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].axis_name"
                      type="text"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    />
                    <!-- backlash_enable：下拉 -->
                    <select
                      v-else-if="isBacklashEnableField(field)"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].backlash_enable"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    >
                      <option :value="false">否</option>
                      <option :value="true">是</option>
                    </select>
                    <!-- merge_params 子字段 -->
                    <input
                      v-else-if="isMergeParamField(field)"
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx].merge_params[mergeParamKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                    <!-- 通用数值 -->
                    <input
                      v-else
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
