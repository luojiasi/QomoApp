// =============================================================================
// 全局键盘快捷键 — 相对运动控制
// App.vue 注册一次，全页面生效。Control.vue 用 useKeyboardJogState 显示步长。
// Settings.vue 用 useKeyboardBindings 读写可配置键位（localStorage 持久化）。
// =============================================================================
import { ref, computed, readonly, reactive } from 'vue'
import { useHardwareState } from './hardware'
import { moveRel, setIoOutput } from './api'

export const IO_OUTPUT_COUNT = 10
export const DEFAULT_IO_PULSE_MS = 500

// ===== Step distance =====
const stepDist = ref(1)
const showStepDialog = ref(false)
const customStepInput = ref('')
const jogSpeed = ref(50)

const stepLabel = computed(() => {
  if (stepDist.value < 1) return stepDist.value.toFixed(2)
  return stepDist.value.toString()
})

function openStepDialog() {
  customStepInput.value = ''
  showStepDialog.value = true
}
export function closeStepDialog() {
  showStepDialog.value = false
}
function applyCustomStep() {
  const v = parseFloat(customStepInput.value)
  if (!isNaN(v) && v > 0) stepDist.value = v
  showStepDialog.value = false
}

// ===== Log callback (set by consumer) =====
let logCb: ((event: string, detail: string) => void) | null = null
export function setKeyboardJogLogger(cb: ((event: string, detail: string) => void) | null) {
  logCb = cb
}

async function kbdMove(axis: string, dir: number) {
  const { controllerConnected } = useHardwareState()
  if (!controllerConnected.value) return
  const dist = stepDist.value * dir
  const dirLabel = dir > 0 ? '+' : '-'
  if (logCb) logCb(`KBD ${axis}${dirLabel}`, `dist=${dist} speed=${jogSpeed.value}%`)
  await moveRel(axis, dist, jogSpeed.value)
}

// ===== IO shortcuts =====
const pulseActive = new Set<number>()
const pulseTimers = new Map<number, ReturnType<typeof setTimeout>>()

function readIoOut(io: number): boolean {
  const { ioOut } = useHardwareState()
  return Boolean(ioOut.value[String(io)] ?? (ioOut.value as Record<number, boolean>)[io])
}

async function toggleIoOutput(io: number) {
  const { controllerConnected } = useHardwareState()
  if (!controllerConnected.value) return
  const next = !readIoOut(io)
  if (logCb) logCb(`IO ${io}`, next ? 'ON' : 'OFF')
  await setIoOutput(io, next)
}

async function pulseIoOutput(io: number, durationMs: number) {
  const { controllerConnected } = useHardwareState()
  if (!controllerConnected.value || pulseActive.has(io)) return
  const ms = Math.max(50, Math.min(60000, Math.round(durationMs) || DEFAULT_IO_PULSE_MS))
  pulseActive.add(io)
  if (logCb) logCb(`IO ${io}`, `PULSE ${ms}ms`)
  try {
    await setIoOutput(io, true)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        pulseTimers.delete(io)
        resolve()
      }, ms)
      pulseTimers.set(io, timer)
    })
    await setIoOutput(io, false)
  } finally {
    const timer = pulseTimers.get(io)
    if (timer !== undefined) {
      clearTimeout(timer)
      pulseTimers.delete(io)
    }
    pulseActive.delete(io)
  }
}

// ===== Key bindings — persisted to localStorage =====
export interface KeyBinding {
  id: string       // stable key for lookup
  label: string    // display name (l10n key) — motion/step; IO uses ioIndex in UI
  key: string      // e.key value, or '' when unbound
  ctrl: boolean
  shift: boolean
  axis: string     // target axis
  dir: number      // ±1
  isStep: boolean  // if true, this binding changes stepDist instead of moving
  stepValue: number   // step value to set (only for isStep)
  stepDialog: boolean // if true, opens custom step dialog
  isIo: boolean       // if true, toggles/pulses an IO output
  ioIndex: number     // OUT index (0..9)
  ioPulse: boolean    // pulse then auto-off (vs toggle)
  pulseMs: number     // pulse duration in ms (ioPulse only)
}

const STORAGE_KEY = 'qomotech:keybindings'

const TOGGLE_DEFAULT_KEYS: Record<number, string> = { 0: 'q', 1: 'w', 2: 'e' }
const PULSE_DEFAULT_KEYS: Record<number, string> = { 2: 'r' }

function makeMotionBindings(): KeyBinding[] {
  const base = {
    isStep: false as const,
    stepValue: 0,
    stepDialog: false,
    isIo: false as const,
    ioIndex: 0,
    ioPulse: false,
    pulseMs: DEFAULT_IO_PULSE_MS
  }
  return [
    { id: 'y_up',    label: 'kbd.yUp',    key: 'ArrowUp',    ctrl: false, shift: false, axis: 'Y', dir:  1, ...base },
    { id: 'y_down',  label: 'kbd.yDown',  key: 'ArrowDown',  ctrl: false, shift: false, axis: 'Y', dir: -1, ...base },
    { id: 'x_left',  label: 'kbd.xLeft',  key: 'ArrowLeft',  ctrl: false, shift: false, axis: 'X', dir: -1, ...base },
    { id: 'x_right', label: 'kbd.xRight', key: 'ArrowRight', ctrl: false, shift: false, axis: 'X', dir:  1, ...base },
    { id: 'u_left',  label: 'kbd.uLeft',  key: 'ArrowLeft',  ctrl: true,  shift: false, axis: 'U', dir: -1, ...base },
    { id: 'u_right', label: 'kbd.uRight', key: 'ArrowRight', ctrl: true,  shift: false, axis: 'U', dir:  1, ...base },
    { id: 'r_up',    label: 'kbd.rUp',    key: 'ArrowUp',    ctrl: true,  shift: false, axis: 'R', dir:  1, ...base },
    { id: 'r_down',  label: 'kbd.rDown',  key: 'ArrowDown',  ctrl: true,  shift: false, axis: 'R', dir: -1, ...base },
    { id: 'z_up',    label: 'kbd.zUp',    key: 'PageUp',     ctrl: false, shift: false, axis: 'Z', dir:  1, ...base },
    { id: 'z_down',  label: 'kbd.zDown',  key: 'PageDown',   ctrl: false, shift: false, axis: 'Z', dir: -1, ...base },
  ]
}

function makeIoBindings(): KeyBinding[] {
  const list: KeyBinding[] = []
  for (let i = 0; i < IO_OUTPUT_COUNT; i++) {
    list.push({
      id: `io_out${i}`,
      label: 'kbd.ioToggle',
      key: TOGGLE_DEFAULT_KEYS[i] ?? '',
      ctrl: false,
      shift: false,
      axis: '',
      dir: 0,
      isStep: false,
      stepValue: 0,
      stepDialog: false,
      isIo: true,
      ioIndex: i,
      ioPulse: false,
      pulseMs: DEFAULT_IO_PULSE_MS
    })
    list.push({
      id: `io_pulse${i}`,
      label: 'kbd.ioPulse',
      key: PULSE_DEFAULT_KEYS[i] ?? '',
      ctrl: false,
      shift: false,
      axis: '',
      dir: 0,
      isStep: false,
      stepValue: 0,
      stepDialog: false,
      isIo: true,
      ioIndex: i,
      ioPulse: true,
      pulseMs: DEFAULT_IO_PULSE_MS
    })
  }
  return list
}

function makeStepBindings(): KeyBinding[] {
  const base = {
    ctrl: false,
    shift: false,
    axis: '',
    dir: 0,
    isStep: true as const,
    isIo: false as const,
    ioIndex: 0,
    ioPulse: false,
    pulseMs: DEFAULT_IO_PULSE_MS
  }
  return [
    { id: 'step001', label: 'kbd.stepF1', key: 'F1', stepValue: 0.01, stepDialog: false, ...base },
    { id: 'step01',  label: 'kbd.stepF2', key: 'F2', stepValue: 0.1,  stepDialog: false, ...base },
    { id: 'step1',   label: 'kbd.stepF3', key: 'F3', stepValue: 1,    stepDialog: false, ...base },
    { id: 'step5',   label: 'kbd.stepF4', key: 'F4', stepValue: 5,    stepDialog: false, ...base },
    { id: 'stepDlg', label: 'kbd.stepF5', key: 'F5', stepValue: 0,    stepDialog: true,  ...base },
  ]
}

const DefaultBindings: KeyBinding[] = [
  ...makeMotionBindings(),
  ...makeIoBindings(),
  ...makeStepBindings()
]

function normalizeBindingKey(key: string): string {
  if (!key) return ''
  return key.length === 1 ? key.toLowerCase() : key
}

function keyMatches(eventKey: string, boundKey: string): boolean {
  if (!boundKey) return false
  if (eventKey === boundKey) return true
  if (eventKey.length === 1 && boundKey.length === 1) {
    return eventKey.toLowerCase() === boundKey.toLowerCase()
  }
  return false
}

function clampPulseMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_IO_PULSE_MS
  return Math.max(50, Math.min(60000, Math.round(ms)))
}

function loadBindings(): KeyBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<KeyBinding>[]
      const map = new Map(saved.map(b => [b.id!, b]))
      return DefaultBindings.map(d => {
        const s = map.get(d.id)
        if (!s) return { ...d }
        return {
          ...d,
          key: normalizeBindingKey(s.key ?? d.key),
          ctrl: s.ctrl ?? d.ctrl,
          shift: s.shift ?? d.shift,
          pulseMs: clampPulseMs(s.pulseMs ?? d.pulseMs)
        }
      })
    }
  } catch { /* ignore */ }
  return DefaultBindings.map(d => ({ ...d }))
}

const bindings = reactive<KeyBinding[]>(loadBindings())

function saveBindings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...bindings]))
}

/** Build a quick-lookup map: "ctrl:shift:key" → axis+dir, for hot path */
function buildLookup(): Map<string, { axis: string; dir: number }> {
  const m = new Map<string, { axis: string; dir: number }>()
  for (const b of bindings) {
    if (!b.key || b.isStep || b.isIo) continue
    const slug = `${b.ctrl ? 'C' : ''}${b.shift ? 'S' : ''}:${normalizeBindingKey(b.key)}`
    m.set(slug, { axis: b.axis, dir: b.dir })
  }
  return m
}

function getLookup() {
  return buildLookup()
}

// ===== Main handler =====
let _registered = false

export function startKeyboardJog() {
  if (_registered) return
  _registered = true

  function handler(e: KeyboardEvent) {
    if (e.repeat) return
    const { controllerConnected } = useHardwareState()
    if (!controllerConnected.value) return
    if (showStepDialog.value) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

    for (const b of bindings) {
      if (!b.key || !b.isIo) continue
      if (
        keyMatches(e.key, b.key) &&
        (e.ctrlKey || e.metaKey) === b.ctrl &&
        e.shiftKey === b.shift
      ) {
        if (b.ioPulse) pulseIoOutput(b.ioIndex, b.pulseMs)
        else toggleIoOutput(b.ioIndex)
        e.preventDefault()
        return
      }
    }

    for (const b of bindings) {
      if (!b.key || !b.isStep) continue
      if (
        keyMatches(e.key, b.key) &&
        (e.ctrlKey || e.metaKey) === b.ctrl &&
        e.shiftKey === b.shift
      ) {
        if (b.stepDialog) openStepDialog()
        else stepDist.value = b.stepValue
        e.preventDefault()
        return
      }
    }

    const lookup = getLookup()
    const slug = `${(e.ctrlKey || e.metaKey) ? 'C' : ''}${e.shiftKey ? 'S' : ''}:${normalizeBindingKey(e.key)}`
    const move = lookup.get(slug)
    if (move) {
      kbdMove(move.axis, move.dir)
      e.preventDefault()
    }
  }

  window.addEventListener('keydown', handler)
}

export function stopKeyboardJog() {
  _registered = false
}

// ===== Public API =====
export function useKeyboardJogState() {
  return {
    stepDist: readonly(stepDist),
    stepLabel: readonly(stepLabel),
    showStepDialog: readonly(showStepDialog),
    customStepInput,
    jogSpeed,
    openStepDialog,
    applyCustomStep
  }
}

/** Settings page: read/write key bindings, reset to defaults. */
export function useKeyboardBindings() {
  function resetToDefaults() {
    bindings.splice(0, bindings.length, ...DefaultBindings.map(d => ({ ...d })))
    saveBindings()
  }

  function updateBinding(id: string, patch: Partial<KeyBinding>) {
    const idx = bindings.findIndex(b => b.id === id)
    if (idx === -1) return
    if (typeof patch.key === 'string') patch.key = normalizeBindingKey(patch.key)
    if (typeof patch.pulseMs === 'number') patch.pulseMs = clampPulseMs(patch.pulseMs)
    Object.assign(bindings[idx], patch)
    saveBindings()
  }

  return {
    bindings,
    DefaultBindings,
    resetToDefaults,
    updateBinding
  }
}
