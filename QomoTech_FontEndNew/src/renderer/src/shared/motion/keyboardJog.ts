// =============================================================================
// 全局键盘快捷键 — 相对运动控制
// App.vue 注册一次，全页面生效。Control.vue 用 useKeyboardJogState 显示步长。
// Settings.vue 用 useKeyboardBindings 读写可配置键位（localStorage 持久化）。
// =============================================================================
import { ref, computed, readonly, reactive } from 'vue'
import { useHardwareState } from './hardware'
import { moveRel } from './api'

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

async function kbdMove(axis: string, dir: number) {
  const { controllerConnected } = useHardwareState()
  if (!controllerConnected.value) return
  const dist = stepDist.value * dir
  await moveRel(axis, dist, jogSpeed.value)
}

// ===== Key bindings — persisted to localStorage =====
export interface KeyBinding {
  id: string       // stable key for lookup
  label: string    // display name (l10n key)
  key: string      // e.key value, or ''
  ctrl: boolean
  shift: boolean
  axis: string     // target axis
  dir: number      // ±1
  isStep: boolean  // if true, this binding changes stepDist instead of moving
  stepValue: number   // step value to set (only for isStep)
  stepDialog: boolean // if true, opens custom step dialog
}

const STORAGE_KEY = 'qomotech:keybindings'

const DefaultBindings: KeyBinding[] = [
  { id: 'y_up',    label: 'kbd.yUp',    key: 'ArrowUp',    ctrl: false, shift: false, axis: 'Y', dir:  1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'y_down',  label: 'kbd.yDown',  key: 'ArrowDown',  ctrl: false, shift: false, axis: 'Y', dir: -1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'x_left',  label: 'kbd.xLeft',  key: 'ArrowLeft',  ctrl: false, shift: false, axis: 'X', dir: -1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'x_right', label: 'kbd.xRight', key: 'ArrowRight', ctrl: false, shift: false, axis: 'X', dir:  1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'u_left',  label: 'kbd.uLeft',  key: 'ArrowLeft',  ctrl: true,  shift: false, axis: 'U', dir: -1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'u_right', label: 'kbd.uRight', key: 'ArrowRight', ctrl: true,  shift: false, axis: 'U', dir:  1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'r_up',    label: 'kbd.rUp',    key: 'ArrowUp',    ctrl: true,  shift: false, axis: 'R', dir:  1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'r_down',  label: 'kbd.rDown',  key: 'ArrowDown',  ctrl: true,  shift: false, axis: 'R', dir: -1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'z_up',    label: 'kbd.zUp',    key: 'PageUp',     ctrl: false, shift: false, axis: 'Z', dir:  1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'z_down',  label: 'kbd.zDown',  key: 'PageDown',   ctrl: false, shift: false, axis: 'Z', dir: -1, isStep: false, stepValue: 0, stepDialog: false },
  { id: 'step001', label: 'kbd.stepF1', key: 'F1',         ctrl: false, shift: false, axis: '', dir: 0, isStep: true, stepValue: 0.01, stepDialog: false },
  { id: 'step01',  label: 'kbd.stepF2', key: 'F2',         ctrl: false, shift: false, axis: '', dir: 0, isStep: true, stepValue: 0.1,  stepDialog: false },
  { id: 'step1',   label: 'kbd.stepF3', key: 'F3',         ctrl: false, shift: false, axis: '', dir: 0, isStep: true, stepValue: 1,    stepDialog: false },
  { id: 'step5',   label: 'kbd.stepF4', key: 'F4',         ctrl: false, shift: false, axis: '', dir: 0, isStep: true, stepValue: 5,    stepDialog: false },
  { id: 'stepDlg', label: 'kbd.stepF5', key: 'F5',         ctrl: false, shift: false, axis: '', dir: 0, isStep: true, stepValue: 0,    stepDialog: true  },
]

function loadBindings(): KeyBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as KeyBinding[]
      // merge saved into defaults (preserve order, fill missing)
      const map = new Map(saved.map(b => [b.id, b]))
      return DefaultBindings.map(d => map.get(d.id) ?? d)
    }
  } catch { /* ignore */ }
  return [...DefaultBindings]
}

const bindings = reactive<KeyBinding[]>(loadBindings())

function saveBindings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...bindings]))
}

/** Build a quick-lookup map: "ctrl:shift:key" → axis+dir, for hot path */
function buildLookup(): Map<string, { axis: string; dir: number }> {
  const m = new Map<string, { axis: string; dir: number }>()
  for (const b of bindings) {
    if (!b.key || b.isStep) continue
    const slug = `${b.ctrl ? 'C' : ''}${b.shift ? 'S' : ''}:${b.key}`
    m.set(slug, { axis: b.axis, dir: b.dir })
  }
  return m
}

// Rebuild lookup whenever bindings change (auto via reactive + proxy)
let lookupCache = buildLookup()

function getLookup() {
  // Invalidate on next lookup — we push it on event to avoid reactivity overhead
  lookupCache = buildLookup()
  return lookupCache
}

// ===== Main handler =====
let _registered = false

export function startKeyboardJog() {
  if (_registered) return
  _registered = true

  function handler(e: KeyboardEvent) {
    // Ignore OS key-repeat events — only fire once per press
    if (e.repeat) return
    const { controllerConnected } = useHardwareState()
    if (!controllerConnected.value) return
    if (showStepDialog.value) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

    // Check step bindings first (closest match wins for modifiers)
    for (const b of bindings) {
      if (!b.key || !b.isStep) continue
      if (
        e.key === b.key &&
        (e.ctrlKey || e.metaKey) === b.ctrl &&
        e.shiftKey === b.shift
      ) {
        if (b.stepDialog) openStepDialog()
        else stepDist.value = b.stepValue
        e.preventDefault()
        return
      }
    }

    // Check move bindings
    const lookup = getLookup()
    const slug = `${(e.ctrlKey || e.metaKey) ? 'C' : ''}${e.shiftKey ? 'S' : ''}:${e.key}`
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

