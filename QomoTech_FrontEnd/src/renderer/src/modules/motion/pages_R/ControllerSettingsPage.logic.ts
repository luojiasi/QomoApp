import { computed, onMounted, ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useMotionExecute } from '../composables/useMotionExecute'
import { useIoOutputs } from '../composables/useIoOutputs'
import { useHardwareState } from '@/shared/api/hardware'
import { cloneSettings, formatSettingValue } from '@/shared/utils/settings'
import { connectMotionWithControllerSettings, emergencyStopMotion } from '../api'
import { AXIS_TAB_LABELS, createControllerSections, defaultControllerParameters } from '../config'
import type { ControllerAxisCount, ControllerAxisUserInput } from '../types'
import type { ParameterField } from '@/shared/types'
import { roundMax, MAX_DECIMALS, SPEED_ENG_DECIMALS, 工程速度转显示速度, 显示速度转工程速度, 运行速度显示单位 } from '../utils'

const USER_AXIS_KEYS = [
  'axis_no', 'axis_name', 'axis_type', 'units', 'speed', 'lspeed',
  'creep', 'accel', 'decel', 'merge', 'sramp',
  'fwd_in', 'rev_in', '正软限位', '负软限位', 'pulses_per_rev', 'electronic_gear_ratio', 'gear_ratio',
  'backlash', 'backlash_enable'
] as const satisfies readonly (keyof ControllerAxisUserInput)[]

const MERGE_PARAM_KEYS = ['corner_mode', 'decel_angle', 'stop_angle', 'zxmooth'] as const
type MergeParamKey = (typeof MERGE_PARAM_KEYS)[number]

function isMergeParamField(field: ParameterField): boolean {
  return (MERGE_PARAM_KEYS as readonly string[]).includes(field.key)
}

function mergeParamKey(field: ParameterField): MergeParamKey {
  return field.key as MergeParamKey
}

function userNumberKey(
  field: ParameterField
): keyof Omit<ControllerAxisUserInput, 'axis_name' | 'merge_params'> {
  return field.key as keyof Omit<ControllerAxisUserInput, 'axis_name' | 'merge_params'>
}

function isBacklashEnableField(field: ParameterField): boolean {
  return field.key === 'backlash_enable'
}

/** 控制器设置页面逻辑：通讯参数、轴配置、连接/急停、IO 控制、在线命令。 */
export function useControllerSettingsPageLogic() {
  const controllerStore = useControllerSettingsStore()
  const { success, error } = useNotification()
  const { position: wsPosition, mposition: wsMposition } = useHardwareState()

  const sections = computed(() => createControllerSections(controllerStore.controllerSettings))

  // 轴数量
  const axisCountValue = computed(() => controllerStore.controllerSettings.communication.axis_count)
  const axisTabLabels = computed(() => AXIS_TAB_LABELS[axisCountValue.value])

  async function handleAxisCountChange(count: ControllerAxisCount): Promise<void> {
    if (count === axisCountValue.value) return
    await controllerStore.setAxisCount(count)
  }

  // 轴参数表格
  const axisIndices = computed(() =>
    Array.from({ length: axisCountValue.value }, (_, i) => i)
  )

  const writeFields = computed(() => {
    const section = sections.value.find((s) => s.id.endsWith('-input'))
    return (
      section?.fields.filter((f) => f.key !== 'axis_no' && f.key !== 'axis_name') ?? []
    )
  })

  // 数值工具
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
    ax[fieldKey] = roundMax(v, fieldKey === 'speed' ? SPEED_ENG_DECIMALS : MAX_DECIMALS)
  }

  function displayAxisSpeed(axisIdx: number): number {
    const ax = controllerStore.controllerSettings.axes[axisIdx]
    if (!ax) return 0
    return roundMax(工程速度转显示速度(ax))
  }

  function setDisplayAxisSpeed(axisIdx: number, raw: string): void {
    const ax = controllerStore.controllerSettings.axes[axisIdx]
    if (!ax) return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    ax.speed = roundMax(显示速度转工程速度(ax, n), SPEED_ENG_DECIMALS)
  }

  function axisSpeedUnit(axisIdx: number): string {
    const ax = controllerStore.controllerSettings.axes[axisIdx]
    return 运行速度显示单位(ax?.axis_name ?? '')
  }

  const speedEditAxis = ref<number | null>(null)
  const speedEditText = ref('')

  function speedInputValue(axisIdx: number): string {
    if (speedEditAxis.value === axisIdx) return speedEditText.value
    return String(displayAxisSpeed(axisIdx))
  }

  function beginSpeedEdit(axisIdx: number): void {
    speedEditAxis.value = axisIdx
    speedEditText.value = String(displayAxisSpeed(axisIdx))
  }

  function onSpeedDraftInput(raw: string): void {
    speedEditText.value = raw
  }

  function commitSpeedEdit(axisIdx: number): void {
    if (speedEditAxis.value === axisIdx) {
      setDisplayAxisSpeed(axisIdx, speedEditText.value)
      normalizeAxisInput(axisIdx, 'speed')
    }
    speedEditAxis.value = null
    speedEditText.value = ''
  }

  // 保存 / 重置
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
      if (res.ok) {
        success('已保存', res.filePath)
        return
      }
      if ('canceled' in res && res.canceled) return
      error('保存失败', 'error' in res ? res.error : '')
    } finally {
      saving.value = false
    }
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

  // 连接 & 急停
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
    } finally {
      connecting.value = false
    }
  }

  const stopping = ref(false)

  async function handleEmergencyStop(): Promise<void> {
    if (stopping.value) return
    stopping.value = true
    try {
      const res = await emergencyStopMotion()
      if (res?.success) {
        success('急停成功', '所有轴已紧急停止')
      } else {
        error('急停失败', res?.message ?? '')
      }
    } catch (e: any) {
      error('急停异常', e?.message ?? '')
    } finally {
      stopping.value = false
    }
  }

  // IO 控制
  const { ioOutputs, ioInputs, togglingIo, handleIoOutputToggle } = useIoOutputs()

  const axisNames = ['X', 'Y', 'Z', 'U', 'R'] as const

  // 在线命令
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

  return {
    // from controllerStore
    controllerStore,
    sections,
    // axis count
    axisCountValue,
    axisTabLabels,
    handleAxisCountChange,
    // axis table
    axisIndices,
    writeFields,
    // utilities
    MAX_DECIMALS,
    roundMax,
    fmtVal,
    axisSpeedUnit,
    speedInputValue,
    beginSpeedEdit,
    onSpeedDraftInput,
    commitSpeedEdit,
    normalizeAxisInput,
    isMergeParamField,
    mergeParamKey,
    userNumberKey,
    isBacklashEnableField,
    // save / reset
    saving,
    handleSaveToFile,
    resetAllAxes,
    // connect / estop
    connecting,
    connected,
    handleConnect,
    stopping,
    handleEmergencyStop,
    // IO
    ioOutputs,
    ioInputs,
    togglingIo,
    handleIoOutputToggle,
    axisNames,
    // hardware
    wsPosition,
    wsMposition,
    // online cmd
    onlineCommandInput,
    onlineCommandResult,
    onlineCommandPending,
    commonOnlineCommands,
    selectedCommonOnlineCommand,
    applyCommonOnlineCommand,
    handleSendOnlineCommand,
    handleOpenOnlineCommandDoc
  }
}
