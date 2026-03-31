<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AXIS_TAB_LABELS, defaultControllerParameters } from '../configs/settings'
import { useControllerSettingsPage } from '../composables/useSettingsPages'
import { useNotification } from '../composables/useNotification'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import type {
  ControllerAxisCount,
  ControllerAxisUserInput,
  ParameterField,
  ParameterSection
} from '../types/settings'
import { cloneSettings, formatSettingValue } from '../utils/settings'
import { subscribeHardwareStatus, type HardwareStatusPayload } from '../utils/motionApi'

const props = defineProps<{
  /**
   * 是否作为嵌入式面板展示（例如显示在 Home 右侧）。
   * 嵌入模式下不显示全页标题与「返回首页」卡片区。
   */
  embedded?: boolean
}>()

const emit = defineEmits<{
  /**
   * 嵌入模式下请求关闭右侧面板。
   */
  (e: 'back'): void
}>()

const controllerStore = useControllerSettingsStore()
const { sections } = useControllerSettingsPage()
const { success, error } = useNotification()

const USER_AXIS_KEYS = [
  'axisNo',
  'axisName',
  'axisType',
  'units',
  'speed',
  'lspeed',
  'creep',
  'accel',
  'decel',
  'merge',
  'sramp',
  'fwd_in',
  'rev_in',
  'corner_mode',
  'decel_angle',
  'stop_angle',
  'zxmooth'
] as const satisfies readonly (keyof ControllerAxisUserInput)[]

function userNumberKey(field: ParameterField): keyof Omit<ControllerAxisUserInput, 'axisName'> {
  return field.key as keyof Omit<ControllerAxisUserInput, 'axisName'>
}

const axisCountValue = computed(() => controllerStore.controllerSettings.communication.axisCount)

const axisTabLabels = computed(
  () => AXIS_TAB_LABELS[controllerStore.controllerSettings.communication.axisCount]
)

async function handleAxisCountChange(count: ControllerAxisCount): Promise<void> {
  if (count === axisCountValue.value) return
  await controllerStore.setAxisCount(count)
}

/** 当前选中的轴（与 axisPairs 下标对应） */
const selectedAxisIndex = ref(0)

// const communicationSection = computed(
//   () => sections.value.find((s) => s.id === 'controller-communication') ?? null
// )

/** 同一轴的「可配置」与「驱动器回读」成对，用于两行布局 */
const axisPairs = computed(() => {
  const list = sections.value.filter((s) => s.id.startsWith('controller-axis-'))
  const pairs: { write: ParameterSection; read: ParameterSection }[] = []
  for (let i = 0; i < list.length; i += 2) {
    const write = list[i]
    const read = list[i + 1]
    if (write && read) pairs.push({ write, read })
  }
  return pairs
})

watch(
  () => axisPairs.value.length,
  (len) => {
    if (len === 0) {
      selectedAxisIndex.value = 0
      return
    }
    if (selectedAxisIndex.value >= len) {
      selectedAxisIndex.value = len - 1
    }
  }
)

const selectedAxisPair = computed(
  () => axisPairs.value[selectedAxisIndex.value] ?? null
)

const axisIndices = computed(() =>
  Array.from({ length: axisCountValue.value }, (_, i) => i)
)

const writeFields = computed(() => selectedAxisPair.value?.write.fields ?? [])
const readFields = computed(() => selectedAxisPair.value?.read.fields ?? [])

const ioInSection = computed(
  () => sections.value.find((s) => s.id === 'controller-io-map-in') ?? null
)
const ioOutSection = computed(
  () => sections.value.find((s) => s.id === 'controller-io-map-out') ?? null
)

type AxisStatusRaw = Record<string, unknown>
let unsubscribeHardwareStatus: (() => void) | null = null

function setAxisNumberField(axis: Record<string, unknown>, key: string, raw: unknown): void {
  const n = Number(raw)
  if (Number.isFinite(n)) axis[key] = n
}

function applyAxisReadback(statusData: Record<string, AxisStatusRaw>): void {
  for (const axis of controllerStore.controllerSettings.axes as Array<Record<string, unknown>>) {
    const status = statusData[String(axis.axisNo)]
    if (!status || typeof status !== 'object') continue

    setAxisNumberField(axis, 'dpos', status.dpos)
    setAxisNumberField(axis, 'mpos', status.mpos)
    setAxisNumberField(axis, 'endmove', status.endmove)
    setAxisNumberField(axis, 'fs_limit', status.fs_limit)
    setAxisNumberField(axis, 'rs_limit', status.rs_limit)
    setAxisNumberField(axis, 'mspeed', status.mspeed)
    setAxisNumberField(axis, 'mtype', status.mtype)
    setAxisNumberField(axis, 'ntype', status.ntype)
    setAxisNumberField(axis, 'vp_speed', status.vp_speed)
    setAxisNumberField(axis, 'axisstatus', status.axisstatus ?? status.axis_status)
    setAxisNumberField(axis, 'move_mark', status.move_mark)
    setAxisNumberField(axis, 'move_curmark', status.move_curmark)
    setAxisNumberField(axis, 'axis_stopforeason', status.axis_stopforeason)
    setAxisNumberField(axis, 'move_buffered', status.move_buffered)
    setAxisNumberField(axis, 'force_speed', status.force_speed)
    setAxisNumberField(axis, 'startmove_speed', status.startmove_speed)
    setAxisNumberField(axis, 'endmove_speed', status.endmove_speed)

    if (typeof status.idle === 'boolean') {
      axis.idle = status.idle ? 1 : 0
    } else {
      setAxisNumberField(axis, 'idle', status.idle)
    }
  }
}

function applyIoReadback(payload?: HardwareStatusPayload): void {
  const ioMapFromState = Array.isArray(payload?.state?.motion_io_map)
    ? payload?.state?.motion_io_map
    : null
  const ioInputs = payload?.motion_driver_status?.io?.inputs
  const ioOutputs = payload?.motion_driver_status?.io?.outputs
  if (!ioMapFromState && !ioInputs && !ioOutputs) return

  for (let i = 0; i < controllerStore.controllerSettings.ioMap.length; i += 1) {
    const row = controllerStore.controllerSettings.ioMap[i]
    if (!row) continue
    const stateRow = ioMapFromState?.[i]
    if (typeof stateRow?.digitalIn === 'boolean') row.digitalIn = stateRow.digitalIn
    if (typeof stateRow?.digitalOut === 'boolean') row.digitalOut = stateRow.digitalOut
    if (ioInputs && typeof ioInputs[String(i)] === 'boolean') row.digitalIn = ioInputs[String(i)]!
    if (ioOutputs && typeof ioOutputs[String(i)] === 'boolean') row.digitalOut = ioOutputs[String(i)]!
  }
}

onMounted(async () => {
  await controllerStore.loadControllerSettings()

  unsubscribeHardwareStatus = subscribeHardwareStatus((res) => {
    if (!res?.success || !res.data || typeof res.data !== 'object') return
    const payload = res.data as HardwareStatusPayload
    const axisFromState = payload.state?.motion_axis_feedback
    const axisFromDriver = payload.motion_driver_status?.axis_status
    const axisData = axisFromState ?? axisFromDriver
    if (axisData && typeof axisData === 'object') {
      applyAxisReadback(axisData as Record<string, AxisStatusRaw>)
    }
    applyIoReadback(payload)
  }, {
    autoStart: true,
    intervalMs: 200,
    runImmediately: true,
  })
})

onUnmounted(() => {
  unsubscribeHardwareStatus?.()
  unsubscribeHardwareStatus = null
})

const saving = ref(false)

async function handleSaveToFile(): Promise<void> {
  saving.value = true
  try {
    const payload = cloneSettings(controllerStore.controllerSettings)
    await controllerStore.saveControllerSettings(payload)
    const json = JSON.stringify(controllerStore.controllerSettings, null, 2)
    const res = await window.api.saveJsonToFile('controller-settings', json)
    if (res.ok) {
      success('已保存', res.filePath)
      return
    }
    if ('canceled' in res && res.canceled) {
      return
    }
    error('保存失败', 'error' in res ? res.error : '')
  } finally {
    saving.value = false
  }
}

function resetCurrentAxisUserInput(): void {
  const idx = selectedAxisIndex.value
  const ax = controllerStore.controllerSettings.axes[idx]
  const def = defaultControllerParameters.axes[idx]
  for (const k of USER_AXIS_KEYS) {
    ;(ax as Record<(typeof USER_AXIS_KEYS)[number], string | number>)[k] = def[k]
  }
  success('已重置', `已恢复当前轴可配置项为默认值（轴 ${idx}）`)
}

const AXIS_VALUE_MAX_DECIMALS = 4

function roundToMaxDecimals(n: number, decimals = AXIS_VALUE_MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

function formatSettingValueMax4Decimals(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return '-'

  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = roundToMaxDecimals(value)
    // toFixed(4) 再去掉尾随 0，达到“最多四位小数”
    let s = rounded.toFixed(AXIS_VALUE_MAX_DECIMALS)
    s = s.replace(/\.?0+$/u, '')
    return unit ? `${s} ${unit}` : s
  }

  return formatSettingValue(value as any, unit)
}

function normalizeAxisNumberInput(axisIdx: number, fieldKey: string): void {
  const ax = controllerStore.controllerSettings.axes[axisIdx] as any
  const v = Number(ax?.[fieldKey])
  if (!Number.isFinite(v)) return
  ax[fieldKey] = roundToMaxDecimals(v)
}
</script>

<template>
  <div
    :class="
      props.embedded ? 'app-page min-h-0 px-4 py-4' : 'app-page min-h-screen px-6 py-10'
    "
  >
    <div v-if="!props.embedded" class="mx-auto max-w-7xl space-y-6">
      <div  class="app-card rounded-2xl p-8 shadow-lg">
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
              {{ n === 3 ? '3 轴（XYZ）' : '5 轴（XYZRU）' }}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <!-- 通讯参数：单行 -->
        <!-- <section v-if="communicationSection" class="app-card rounded-2xl p-6 shadow-sm">
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
        </section> -->

        <!-- 轴参数：标题与轴按钮同一行；其下 I/O 输出单行；再下左写入 / 右回读 -->
        <section v-if="axisPairs.length && selectedAxisPair" class="app-card rounded-2xl p-6 shadow-sm">
          <!-- 一行：轴参数 + 轴切换按钮 -->
          <div
            class="flex flex-wrap items-center gap-3 border-b border-(--app-border) pb-4"
          >
            <h2 class="app-text-primary shrink-0 text-xl font-semibold">轴参数</h2>
            <!-- <div class="flex min-w-0 flex-1 flex-wrap gap-2">
              <button
                v-for="(pair, i) in axisPairs"
                :key="pair.write.id"
                type="button"
                class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                :class="
                  selectedAxisIndex === i
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'app-card-soft border-transparent hover:border-(--app-border)'
                "
                @click="selectedAxisIndex = i"
              >
                {{ axisTabLabels[i] }} 轴
              </button>
            </div> -->
            <div class="ml-auto flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetCurrentAxisUserInput"
              >
                重置
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

          <!-- 蓝色区域：I/O 数字量输出（驱动器回读），9 组单行（窄屏横向滚动） -->
           <div class="grid grid-cols-2 gap-3 justify-center ">
            <aside
            v-if="ioOutSection"
            class="mt-4 rounded-xl border-2 border-blue-500/50 bg-blue-950/25 p-3 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.2)]"
          >
            <div class="flex items-baseline justify-between gap-2 gap-y-1">
              <p class="text-sm font-semibold text-blue-900">{{ ioOutSection.title }}</p>
            </div>
            <div
              class="mt-2 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]"
            >
              <div
                v-for="field in ioOutSection.fields"
                :key="field.key"
                class="min-w-6 shrink-0 rounded-lg border px-2 py-1.5 transition-colors"
                :class="
                  field.value === true
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : 'border-blue-500/25 bg-(--app-card-soft)'
                "
              >
                <p class="app-text-muted text-[10px] leading-tight">{{ field.label }}</p>
                <p
                  class="mt-0.5 truncate text-xs font-medium"
                  :class="field.value === true ? 'text-emerald-800' : 'text-blue-600'"
                >
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </aside>

            <aside
              v-if="ioInSection"
              class="mt-4 rounded-xl border-2 border-blue-500/50 bg-blue-950/25 p-3 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.2)]"
            >
              <div class="flex items-baseline justify-between gap-2 gap-y-1">
                <p class="text-sm font-semibold text-blue-900">{{ ioInSection.title }}</p>
              </div>
              <div
                class="mt-2 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]"
              >
                <div
                  v-for="field in ioInSection.fields"
                  :key="field.key"
                  class="min-w-6 shrink-0 rounded-lg border px-2 py-1.5 transition-colors"
                  :class="
                    field.value === true
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-blue-500/25 bg-(--app-card-soft)'
                  "
                >
                  <p class="app-text-muted text-[10px] leading-tight">{{ field.label }}</p>
                  <p
                    class="mt-0.5 truncate text-xs font-medium"
                    :class="field.value === true ? 'text-emerald-800' : 'text-blue-600'"
                  >
                    {{ formatSettingValue(field.value, field.unit) }}
                  </p>
                </div>
              </div>
            </aside>
           </div>


          <div class="mt-5 grid gap-6 lg:hidden">
            <!-- 左：该轴可写入 -->
            <div
              class="rounded-xl border-2 border-rose-500/35 bg-rose-950/10 p-4 shadow-sm"
            >
              <h3 class="app-text-primary text-sm font-semibold">可配置（写入）</h3>
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`write-col-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in writeFields"
                      :key="field.key"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`${field.key}-${axisIdx}`"
                        class="px-3 py-1.5 align-middle"
                      >
                        <input
                          v-if="field.key === 'axisName'"
                          v-model="controllerStore.controllerSettings.axes[axisIdx].axisName"
                          type="text"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                        <input
                          v-else
                          v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                          type="number"
                          :step="0.0001"
                          @blur="normalizeAxisNumberInput(axisIdx, field.key)"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 右：该轴驱动器回读 -->
            <div
              class="rounded-xl border-2 border-rose-500/35 bg-rose-950/10 p-4 shadow-sm"
            >
              <h3 class="app-text-primary text-sm font-semibold">驱动器回读（只读）</h3>
              <p class="app-text-muted mt-1 text-xs">{{ selectedAxisPair.read.description }}</p>
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`read-col-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in readFields"
                      :key="field.key"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`${field.key}-read-${axisIdx}`"
                        class="px-3 py-2 text-center"
                      >
                        <p class="text-sm font-medium app-text-primary">
                          {{
                            formatSettingValueMax4Decimals(
                              (controllerStore.controllerSettings.axes[axisIdx] as any)[field.key],
                              field.unit
                            )
                          }}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>




          <div class="mt-5 gap-6 hidden lg:grid lg:grid-cols-2">
            <!-- 左：该轴可写入 -->
            <div
              class="rounded-xl border-2 border-rose-500/35 bg-rose-950/10 p-4 shadow-sm"
            >
              <h3 class="app-text-primary text-sm font-semibold">可配置（写入）</h3>
              <p class="app-text-muted mt-1 text-xs">{{ selectedAxisPair.write.description }}</p>
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`write-col-lg-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in writeFields"
                      :key="`write-row-${field.key}`"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`write-cell-${field.key}-${axisIdx}`"
                        class="px-3 py-1.5 align-middle"
                      >
                        <input
                          v-if="field.key === 'axisName'"
                          v-model="controllerStore.controllerSettings.axes[axisIdx].axisName"
                          type="text"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                        <input
                          v-else
                          v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                          type="number"
                          :step="0.0001"
                          @blur="normalizeAxisNumberInput(axisIdx, field.key)"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 右：该轴驱动器回读 -->
            <div
              class="rounded-xl border-2 border-rose-500/35 bg-rose-950/10 p-4 shadow-sm"
            >
              <h3 class="app-text-primary text-sm font-semibold">驱动器回读（只读）</h3>
              <p class="app-text-muted mt-1 text-xs">{{ selectedAxisPair.read.description }}</p>
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`read-col-lg-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in readFields"
                      :key="`read-row-${field.key}`"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`read-cell-${field.key}-${axisIdx}`"
                        class="px-3 py-2 text-center"
                      >
                        <p class="text-sm font-medium app-text-primary">
                          {{
                            formatSettingValueMax4Decimals(
                              (controllerStore.controllerSettings.axes[axisIdx] as any)[field.key],
                              field.unit
                            )
                          }}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>


    <div v-else class="mx-auto max-w-7xl space-y-6">
      <div class="space-y-6">

        <!-- 轴参数：标题与轴按钮同一行；其下 I/O 输出单行；再下左写入 / 右回读 -->
        <section v-if="axisPairs.length && selectedAxisPair" class="app-card rounded-2xl p-6 shadow-sm">
          <div
            class="flex flex-wrap items-center gap-3 border-b border-(--app-border) pb-4"
          >
            <h2 class="app-text-primary shrink-0 text-xl font-semibold">轴参数</h2>
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
                class="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetCurrentAxisUserInput"
              >
                重置
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


          <!-- 蓝色区域：I/O 数字量输出（驱动器回读），9 组单行（窄屏横向滚动） -->
           <div class="grid grid-cols-2 gap-3 justify-center ">
            <aside v-if="ioOutSection">
            <div class="mt-2 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]" >
              <div
                v-for="field in ioOutSection.fields"
                :key="field.key"
                class="min-w-6 shrink-0 rounded-lg border px-2 py-1.5 transition-colors"
                :class="
                  field.value === true
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : 'border-blue-500/25 bg-(--app-card-soft)'
                "
              >
                <p
                  class="mt-0.5 truncate text-xs font-medium"
                  :class="field.value === true ? 'text-emerald-800' : 'text-blue-600'"
                >
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </aside>

            <aside v-if="ioInSection" >
              <div class="mt-2 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]" >
                <div
                  v-for="field in ioInSection.fields"
                  :key="field.key"
                  class="min-w-6 shrink-0 rounded-lg border px-2 py-1.5 transition-colors"
                  :class="
                    field.value === true
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-blue-500/25 bg-(--app-card-soft)'
                  "
                >
                  <p
                    class="mt-0.5 truncate text-xs font-medium"
                    :class="field.value === true ? 'text-emerald-800' : 'text-blue-600'"
                  >
                    {{ formatSettingValue(field.value, field.unit) }}
                  </p>
                </div>
              </div>
            </aside>
           </div>


          <div class="mt-5 grid gap-6 lg:hidden">
            <!-- 左：该轴可写入 -->
            <div class="rounded-xl border-2 border-rose-500 bg-rose-950/10 p-4 shadow-sm" >
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`write-col-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in writeFields"
                      :key="field.key"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`${field.key}-${axisIdx}`"
                        class="px-3 py-1.5 align-middle"
                      >
                        <input
                          v-if="field.key === 'axisName'"
                          v-model="controllerStore.controllerSettings.axes[axisIdx].axisName"
                          type="text"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                        <input
                          v-else
                          v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                          type="number"
                          :step="0.0001"
                          @blur="normalizeAxisNumberInput(axisIdx, field.key)"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>




          <div class="mt-5 gap-6 hidden lg:grid lg:grid-cols-1">
            <!-- 左：该轴可写入 -->
            <div
              class="rounded-xl border-2 border-rose-500/35 bg-rose-950/10 p-4 shadow-sm"
            >
              <div class="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
                <table class="min-w-[860px] w-full border border-(--app-border) border-collapse">
                  <thead>
                    <tr class="border-b border-(--app-border)">
                      <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2 text-left text-xs font-semibold app-text-secondary">
                        参数
                      </th>
                      <th
                        v-for="axisIdx in axisIndices"
                        :key="`write-col-lg-${axisIdx}`"
                        class="px-3 py-2 text-center text-xs font-semibold app-text-secondary"
                      >
                        轴{{ axisIdx }}
                        <div class="text-[10px] font-normal app-text-muted mt-0.5">
                          {{ axisTabLabels[axisIdx] }}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="field in writeFields"
                      :key="`write-row-${field.key}`"
                      class="border-b border-(--app-border)"
                    >
                      <td
                        class="sticky left-0 z-5 bg-rose-950/10 px-3 py-2 text-xs font-medium app-text-secondary"
                      >
                        {{ field.label }}
                      </td>
                      <td
                        v-for="axisIdx in axisIndices"
                        :key="`write-cell-${field.key}-${axisIdx}`"
                        class="px-3 py-1.5 align-middle"
                      >
                        <input
                          v-if="field.key === 'axisName'"
                          v-model="controllerStore.controllerSettings.axes[axisIdx].axisName"
                          type="text"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                        <input
                          v-else
                          v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                          type="number"
                          :step="0.0001"
                          @blur="normalizeAxisNumberInput(axisIdx, field.key)"
                          class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
