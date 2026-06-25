<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  startHardwareMonitor,
  stopHardwareMonitor,
  useHardwareState,
  jogAxis,
  jogStop,
  estop,
  stop,
  connectMotion,
  disconnectMotion,
  setMotionAllAxesParams,
  buildMotionAllAxesParamsPayload,
  homeAxes,
  zeroMotionAxis,
  getControllerSettings,
  defaultControllerParameters,
  useKeyboardJogState
} from '../shared/motion'
import type { ControllerParameters } from '../shared/motion'

const {
  controllerConnected,
  wsConnected,
  mposition,
  ioOut,
  controllerState
} = useHardwareState()

const jogSpeed = ref(50)
const isConnecting = ref(false)

// Axis names matching the control page layout
const AXIS_KEYS = ['X', 'Y', 'Z', 'U', 'R'] as const
type AxisKey = (typeof AXIS_KEYS)[number]

const axisMeta: Record<AxisKey, { unit: string; color: string }> = {
  X: { unit: 'mm', color: 'primary' },
  Y: { unit: 'mm', color: 'primary' },
  Z: { unit: 'mm', color: 'primary' },
  U: { unit: 'deg', color: 'tertiary' },
  R: { unit: 'deg', color: 'tertiary' }
}

function formatPosition(val: number | undefined | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-'
  return val.toFixed(3)
}

// Active jog state
const jogDir = reactive<Record<AxisKey, number>>({ X: 0, Y: 0, Z: 0, U: 0, R: 0 })
const activeJogAxis = ref<AxisKey | null>(null)

// Joystick — XY 360° drag (speed matches jogSpeed slider)
const joystickAngle = ref(0)
const joystickRadius = ref(0)
const joystickDragging = ref(false)
const joystickEl = ref<HTMLElement | null>(null)
const STICK_RANGE = 56

function stickStyle() {
  const rad = (joystickAngle.value * Math.PI) / 180
  const r = joystickRadius.value * STICK_RANGE
  // atan2(dy,dx) already matches screen coords: dx right +, dy down +
  // knob should follow the pointer, so translate(dx, dy) = translate(cos*r, sin*r)
  // display angle = atan2(-dy,dx) → knob pos = (cos(deg)*r, -sin(deg)*r) in screen space
  return { transform: `translate(${Math.cos(rad) * r}px, ${-Math.sin(rad) * r}px)` }
}

function onStickDown(e: PointerEvent) {
  if (!controllerConnected.value) return
  joystickDragging.value = true
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  updateStick(e)
}

function onStickMove(e: PointerEvent) {
  if (!joystickDragging.value) return
  updateStick(e)
}

function onStickUp() {
  if (!joystickDragging.value) return
  joystickDragging.value = false
  joystickAngle.value = 0
  joystickRadius.value = 0
  if (jogDir.X !== 0) { jogDir.X = 0; jogStop('X') }
  if (jogDir.Y !== 0) { jogDir.Y = 0; jogStop('Y') }
}

function updateStick(e: PointerEvent) {
  const el = joystickEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy
  const dist = Math.min(STICK_RANGE, Math.sqrt(dx * dx + dy * dy))
  // screen deg: 0°=right, 90°=up, 180°=left, 270°=down
  const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360
  const pct = dist / STICK_RANGE

  joystickAngle.value = Math.round(deg)
  joystickRadius.value = Math.round(pct * 100) / 100

  // direction from dx,dy directly (NOT from deg)
  const xNorm = dist > 0.01 ? dx / dist : 0
  const yNorm = dist > 0.01 ? -dy / dist : 0

  const totalSpd = Math.max(1, Math.round(pct * jogSpeed.value))
  const xSpd = Math.max(1, Math.round(Math.abs(xNorm) * totalSpd))
  const ySpd = Math.max(1, Math.round(Math.abs(yNorm) * totalSpd))

  // X
  if (Math.abs(xNorm) > 0.08) {
    const d = xNorm > 0 ? 1 : -1
    if (jogDir.X !== d) { if (jogDir.X) jogStop('X'); jogDir.X = d; jogAxis('X', d, xSpd) }
  } else if (jogDir.X) { jogDir.X = 0; jogStop('X') }

  // Y
  if (Math.abs(yNorm) > 0.08) {
    const d = yNorm > 0 ? 1 : -1
    if (jogDir.Y !== d) { if (jogDir.Y) jogStop('Y'); jogDir.Y = d; jogAxis('Y', d, ySpd) }
  } else if (jogDir.Y) { jogDir.Y = 0; jogStop('Y') }
}

async function startJog(axis: AxisKey, dir: number) {
  if (!controllerConnected.value) return
  jogDir[axis] = dir
  activeJogAxis.value = axis
  await jogAxis(axis, dir, jogSpeed.value)
}

async function stopJog(axis: AxisKey) {
  jogDir[axis] = 0
  activeJogAxis.value = null
  await jogStop(axis)
}

async function handleEstop() {
  await estop()
}

async function handleStopToIdle() {
  if (!controllerConnected.value) return
  await stop()
}

async function handleHomeAll() {
  if (!controllerConnected.value) return
  await homeAxes()
}

async function handleZeroAxis(axis: AxisKey) {
  if (!controllerConnected.value) return
  await zeroMotionAxis(axis)
}

// Keyboard shortcuts — global, registered in App.vue. Use shared step state.
const { stepLabel, openStepDialog, jogSpeed: kbdSpeed } = useKeyboardJogState()

// Sync jogSpeed slider → keyboard relative-move speed
watch(jogSpeed, v => { kbdSpeed.value = v }, { immediate: true })

async function toggleConnection() {
  isConnecting.value = true
  try {
    if (controllerConnected.value) {
      await disconnectMotion()
    } else {
      // Load controller settings and use saved IP (fallback to default IP)
      let ip = '192.168.0.11'
      try {
        const res = await getControllerSettings()
        if (res.success && res.data) {
          const data = res.data as ControllerParameters
          if (data.communication?.controller_ip) {
            ip = data.communication.controller_ip
          }
        }
      } catch { /* use default IP */ }
      await connectMotion(ip)
      // Bootstrap: push axis params after connecting
      try {
        const settingsRes = await getControllerSettings()
        if (settingsRes.success && settingsRes.data) {
          const settings = settingsRes.data as ControllerParameters
          if (settings.axes?.length > 0) {
            const payload = buildMotionAllAxesParamsPayload(settings)
            await setMotionAllAxesParams(payload)
          }
        } else {
          const payload = buildMotionAllAxesParamsPayload(defaultControllerParameters)
          await setMotionAllAxesParams(payload)
        }
      } catch { /* params push is best-effort */ }
    }
  } catch { /* ignore */ }
  isConnecting.value = false
}

// Program status (simulated for now — will be replaced by WebSocket)
const programProgress = ref(65)
const programElapsed = ref('00:42:15')
const laserPower = ref('3.5')
const feedRate = ref('12,400')

// G-code log
interface GCmdLine { line: string; code: string; active: boolean }
const gcodeLines = ref<GCmdLine[]>([])

onMounted(() => {
  startHardwareMonitor()
})

onUnmounted(() => {
  stopHardwareMonitor()
})

// IO status
const ioOutput0 = computed(() => ioOut.value[0] ?? false)
const ioOutput1 = computed(() => ioOut.value[1] ?? false)
const ioOutput2 = computed(() => ioOut.value[2] ?? false)
</script>

<template>
  <div class="control-page">
    <div class="control-main">
      <!-- Axis readouts -->
      <div class="axis-grid">
        <div
          v-for="axis in AXIS_KEYS"
          :key="axis"
          class="axis-card"
          :class="`axis-${axisMeta[axis].color}`"
        >
          <div class="axis-header">
            <label class="axis-label">{{ axis }}-Axis</label>
            <span class="axis-ws-dot" :class="{ connected: wsConnected }"></span>
          </div>
          <span class="axis-value">{{ formatPosition(mposition[axis]) }}</span>
          <span class="axis-unit">{{ axisMeta[axis].unit }}</span>
        </div>
      </div>

      <!-- 3D workspace -->
      <div class="workspace">
        <div class="workspace-badge">
          <span class="badge-dot" :class="{ connected: controllerConnected }"></span>
          {{ controllerConnected ? controllerState : '未连接控制器' }}
        </div>
        <div class="workspace-area">
          <span class="workspace-placeholder">WORKSPACE VIEW</span>
        </div>
        <div class="workspace-tools">
          <button class="tool-btn" @click="toggleConnection" :disabled="isConnecting">
            <span class="material-symbols-outlined">
              {{ controllerConnected ? 'link_off' : 'link' }}
            </span>
          </button>
          <button class="tool-btn" @click="handleStopToIdle" :disabled="!controllerConnected" title="Stop → IDLE">
            <span class="material-symbols-outlined" style="color: var(--color-warning)">stop</span>
          </button>
          <button class="tool-btn" @click="handleEstop" :disabled="!controllerConnected">
            <span class="material-symbols-outlined" style="color: var(--color-error)">emergency</span>
          </button>
        </div>
      </div>

      <!-- Status bar -->
      <div class="control-statusbar">
        <div class="stat-item">
          <span class="stat-label">LASER POWER</span>
          <span class="stat-value text-primary">{{ laserPower }}kW</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">FEED RATE</span>
          <span class="stat-value">{{ feedRate }} <span class="stat-unit">mm/min</span></span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">IO 0 (气源)</span>
          <span class="stat-value" :class="ioOutput0 ? 'text-primary' : ''">
            <span class="io-dot" :class="{ on: ioOutput0 }"></span>
            {{ ioOutput0 ? 'ON' : 'OFF' }}
          </span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">IO 1 (可见光)</span>
          <span class="stat-value" :class="ioOutput1 ? 'text-primary' : ''">
            <span class="io-dot" :class="{ on: ioOutput1 }"></span>
            {{ ioOutput1 ? 'ON' : 'OFF' }}
          </span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">IO 2 (激光)</span>
          <span class="stat-value" :class="ioOutput2 ? 'text-primary' : ''">
            <span class="io-dot" :class="{ on: ioOutput2 }"></span>
            {{ ioOutput2 ? 'ON' : 'OFF' }}
          </span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-progress">
          <div class="stat-progress-info">
            <span class="material-symbols-outlined stat-clock">schedule</span>
            <span class="stat-label">EST: {{ programElapsed }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${programProgress}%` }"></div>
          </div>
          <span class="stat-label">{{ programProgress }}% COMPLETED</span>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <aside class="control-sidebar">
      <!-- Jog controller -->
      <div class="jog-card">
        <h4 class="jog-title">Jog Controller</h4>

        <div class="jog-dial-container">
          <!-- outer ring -->
          <div class="jog-dial-outer">
            <svg class="jog-outer-svg" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="108" fill="none" stroke="rgba(65,71,84,0.25)" stroke-width="2"/>
              <g v-for="d in [0,15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240,255,270,285,300,315,330,345]" :key="d" :transform="`rotate(${d} 110 110)`">
                <line v-if="d%90===0" x1="110" y1="4" x2="110" y2="18" stroke="rgba(173,199,255,0.5)" stroke-width="2" stroke-linecap="round"/>
                <line v-else-if="d%45===0" x1="110" y1="4" x2="110" y2="14" stroke="rgba(173,199,255,0.3)" stroke-width="1.5" stroke-linecap="round"/>
                <line v-else-if="d%15===0" x1="110" y1="4" x2="110" y2="10" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-linecap="round"/>
              </g>
            </svg>
          </div>
          <!-- inner well -->
          <div
            ref="joystickEl"
            class="jog-dial-inner"
            :class="{ dragging: joystickDragging }"
            @pointerdown="onStickDown"
            @pointermove="onStickMove"
            @pointerup="onStickUp"
            @pointerleave="onStickUp"
            @pointercancel="onStickUp"
          >
            <div class="jog-guide-ring"></div>
            <div class="jog-cross-h"></div>
            <div class="jog-cross-v"></div>
            <div class="jog-ripple" :class="{ active: joystickDragging }"></div>
            <div class="jog-knob" :style="stickStyle()">
              <div class="jog-knob-core"></div>
            </div>
          </div>
          <!-- knob readout -->
          <div class="jog-stick-info">
            <span class="stick-degree">{{ joystickRadius > 0.05 ? joystickAngle + '°' : '' }}</span>
            <span class="stick-speed">{{ joystickRadius > 0.05 ? Math.round(joystickRadius * jogSpeed) + '%' : '' }}</span>
          </div>
        </div>

        <!-- X/Y button jog: X- Y+ -->
        <div class="z-jog-row">
          <button class="z-jog-btn" :class="{ active: jogDir.X < 0 }"
            @mousedown="startJog('X', -1)" @mouseup="stopJog('X')"
            @mouseleave="jogDir.X < 0 ? stopJog('X') : undefined"
            :disabled="!controllerConnected">
            <span class="material-symbols-outlined">keyboard_arrow_left</span> X-
          </button>
          <button class="z-jog-btn" :class="{ active: jogDir.Y > 0 }"
            @mousedown="startJog('Y', 1)" @mouseup="stopJog('Y')"
            @mouseleave="jogDir.Y > 0 ? stopJog('Y') : undefined"
            :disabled="!controllerConnected">
            Y+ <span class="material-symbols-outlined">keyboard_arrow_up</span>
          </button>
        </div>
        <!-- X/Y button jog: X+ Y- -->
        <div class="z-jog-row">
          <button class="z-jog-btn" :class="{ active: jogDir.X > 0 }"
            @mousedown="startJog('X', 1)" @mouseup="stopJog('X')"
            @mouseleave="jogDir.X > 0 ? stopJog('X') : undefined"
            :disabled="!controllerConnected">
            <span class="material-symbols-outlined">keyboard_arrow_right</span> X+
          </button>
          <button class="z-jog-btn" :class="{ active: jogDir.Y < 0 }"
            @mousedown="startJog('Y', -1)" @mouseup="stopJog('Y')"
            @mouseleave="jogDir.Y < 0 ? stopJog('Y') : undefined"
            :disabled="!controllerConnected">
            Y- <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </div>

        <!-- Z axis jog -->
        <div class="z-jog-row">
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.Z > 0 }"
            @mousedown="startJog('Z', 1)"
            @mouseup="stopJog('Z')"
            @mouseleave="jogDir.Z > 0 ? stopJog('Z') : undefined"
            :disabled="!controllerConnected"
          >
            <span class="material-symbols-outlined">keyboard_arrow_up</span>
            Z+
          </button>
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.Z < 0 }"
            @mousedown="startJog('Z', -1)"
            @mouseup="stopJog('Z')"
            @mouseleave="jogDir.Z < 0 ? stopJog('Z') : undefined"
            :disabled="!controllerConnected"
          >
            Z-
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </div>

         <!-- U axis jog -->
         <div class="z-jog-row">
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.U > 0 }"
            @mousedown="startJog('U', 1)"
            @mouseup="stopJog('U')"
            @mouseleave="jogDir.U > 0 ? stopJog('U') : undefined"
            :disabled="!controllerConnected"
          >
            <span class="material-symbols-outlined">keyboard_arrow_up</span>
            U+
          </button>
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.U < 0 }"
            @mousedown="startJog('U', -1)"
            @mouseup="stopJog('U')"
            @mouseleave="jogDir.U < 0 ? stopJog('U') : undefined"
            :disabled="!controllerConnected"
          >
            U-
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </div>
         <!-- R axis jog -->
         <div class="z-jog-row">
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.R > 0 }"
            @mousedown="startJog('R', 1)"
            @mouseup="stopJog('R')"
            @mouseleave="jogDir.R > 0 ? stopJog('R') : undefined"
            :disabled="!controllerConnected"
          >
            <span class="material-symbols-outlined">keyboard_arrow_up</span>
            R+
          </button>
          <button
            class="z-jog-btn"
            :class="{ active: jogDir.R < 0 }"
            @mousedown="startJog('R', -1)"
            @mouseup="stopJog('R')"
            @mouseleave="jogDir.R < 0 ? stopJog('R') : undefined"
            :disabled="!controllerConnected"
          >
            R-
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </div>

        <!-- Step distance indicator -->
        <div class="step-info">
          <span class="step-label">STEP</span>
          <span class="step-value">{{ stepLabel }}</span>
          <span class="step-unit">mm/deg</span>
          <button class="step-f5-btn" @click="openStepDialog">F5</button>
        </div>
        <!-- Speed slider -->
        <div class="jog-speed">
          <div class="speed-header">
            <span class="speed-label">JOG SPEED</span>
            <span class="speed-value">{{ jogSpeed }}%</span>
          </div>
          <input v-model.number="jogSpeed" type="range" class="speed-slider" min="1" max="100" />
          <div class="speed-ticks">
            <span>MIN</span>
            <span>50%</span>
            <span>MAX</span>
          </div>
        </div>
        <!-- Home & Zero actions -->
        <div class="jog-actions">
          <button class="action-btn home" @click="handleHomeAll" :disabled="!controllerConnected">
            <span class="material-symbols-outlined">home</span>
            HOME ALL
          </button>
          <button class="action-btn zero" @click="handleZeroAxis('X')" :disabled="!controllerConnected">
            X0
          </button>
          <button class="action-btn zero" @click="handleZeroAxis('Y')" :disabled="!controllerConnected">
            Y0
          </button>
          <button class="action-btn zero" @click="handleZeroAxis('Z')" :disabled="!controllerConnected">
            Z0
          </button>
          <button class="action-btn zero" @click="handleZeroAxis('U')" :disabled="!controllerConnected">
            U0
          </button>
          <button class="action-btn zero" @click="handleZeroAxis('R')" :disabled="!controllerConnected">
            R0
          </button>
        </div>
      </div>

      <!-- G-code monitor -->
      <div class="gcode-card">
        <div class="gcode-header">
          <span class="gcode-title">ACTIVE G-CODE</span>
          <span class="material-symbols-outlined gcode-icon">code</span>
        </div>
        <div class="gcode-list">
          <div
            v-for="line in gcodeLines"
            :key="line.line"
            class="gcode-line"
            :class="{ active: line.active, dim: !line.active }"
          >
            <span>{{ line.line }}</span>
            <span>{{ line.code }}</span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.control-page {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.control-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 24px;
  background: var(--color-surface);
  overflow-y: auto;
}

/* Axis grid */
.axis-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.axis-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 8px;
}

.axis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.axis-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  display: block;
}

.axis-primary .axis-label { color: var(--color-primary); }
.axis-tertiary .axis-label { color: var(--color-tertiary); }

.axis-ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error-container);
  border: 1px solid var(--color-error);
}

.axis-ws-dot.connected {
  background: var(--color-primary-container);
  border-color: var(--color-primary);
  animation: status-pulse 2s infinite ease-in-out;
}

.axis-value {
  font-size: 28px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--color-on-background);
  letter-spacing: -0.01em;
}

.axis-unit {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  margin-left: 4px;
}

/* Workspace */
.workspace {
  flex: 1;
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  min-height: 200px;
}

.workspace-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(28, 32, 39, 0.8);
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--color-outline-variant);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-error);
}

.badge-dot.connected {
  background: #22c55e;
  animation: pulse 2s infinite ease-in-out;
}

.workspace-area {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
}

.workspace-placeholder {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--color-on-surface-variant);
  letter-spacing: 0.2em;
}

.workspace-tools {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
}

.tool-btn {
  padding: 8px;
  background: var(--color-surface-container-highest);
  border: none;
  border-radius: 4px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Status bar */
.control-statusbar {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-surface-container-low);
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-unit { font-size: 11px; font-weight: 400; }

.text-primary { color: var(--color-primary); }

.io-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-outline);
}

.io-dot.on {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--color-outline-variant);
}

.stat-progress {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(49, 53, 61, 0.5);
  padding: 8px 16px;
  border-radius: 4px;
}

.stat-progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-clock { font-size: 14px; color: var(--color-primary); }

.progress-bar {
  width: 128px;
  height: 6px;
  background: var(--color-outline-variant);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
}

/* Control sidebar */
.control-sidebar {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  overflow-y: auto;
  flex-shrink: 0;
}

.jog-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.jog-title {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 16px;
}

.jog-dial-container {
  position: relative;
  width: 220px;
  height: 220px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

/* outer ring — absolute center */
.jog-dial-outer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.jog-outer-svg { width: 100%; height: 100%; }

/* inner well — absolute center, same parent */
.jog-dial-inner {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(36,39,42,0.9), rgba(26,29,34,0.96));
  border: 2px solid rgba(65,71,84,0.35);
  box-shadow: 0 0 0 6px rgba(28,30,36,0.55), 0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.jog-dial-inner:active { cursor: grabbing; }
.jog-dial-inner.dragging {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 6px rgba(28,30,36,0.55), 0 4px 32px rgba(0,0,0,0.5), 0 0 24px rgba(173,199,255,0.22), inset 0 1px 0 rgba(255,255,255,0.03);
}

/* guides */
.jog-guide-ring {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
  pointer-events: none;
}
.jog-cross-h, .jog-cross-v {
  position: absolute;
  background: rgba(255,255,255,0.05);
  pointer-events: none;
}
.jog-cross-h { width: 65%; height: 1px; }
.jog-cross-v { width: 1px; height: 65%; }

/* ripple */
.jog-ripple {
  position: absolute; inset: 20px; border-radius: 50%;
  border: 2px solid transparent; opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.jog-ripple.active {
  border-color: rgba(173,199,255,0.18); opacity: 1;
  animation: ripple-out 1.2s ease-out infinite;
}
@keyframes ripple-out {
  0%   { inset: 20px; border-color: rgba(173,199,255,0.25); }
  50%  { inset: 10px; border-color: rgba(173,199,255,0.06); }
  100% { inset: 0;    border-color: transparent; }
}

/* knob */
.jog-knob {
  position: absolute; z-index: 2; pointer-events: none;
  transition: transform 0.05s ease-out;
  display: flex; align-items: center; justify-content: center;
}
.jog-knob-core {
  width: 30px; height: 30px;
  background: radial-gradient(circle at 40% 35%, rgba(210,222,255,0.95), var(--color-primary));
  border-radius: 50%;
  box-shadow: 0 0 14px rgba(173,199,255,0.55), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  transition: width 0.2s, height 0.2s, box-shadow 0.2s;
}
.jog-dial-inner.dragging .jog-knob-core {
  width: 34px; height: 34px;
  box-shadow: 0 0 26px rgba(173,199,255,0.85), 0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
}

/* readout */
.jog-stick-info {
  display: flex; justify-content: center; gap: 16px; margin-top: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 13px; height: 18px;
}
.stick-degree { color: var(--color-primary); font-weight: 600; min-width: 36px; text-align: right; }
.stick-speed  { color: var(--color-on-surface-variant); min-width: 40px; }

/* Z jog */
.z-jog-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.z-jog-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 20px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  cursor: pointer;
  transition: all 0.15s;
}

.z-jog-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.z-jog-btn.active { background: rgba(173, 199, 255, 0.2); border-color: var(--color-primary); color: var(--color-primary); }
.z-jog-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.z-jog-btn .material-symbols-outlined { font-size: 16px; }

.jog-speed {
  width: 100%;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline-variant);
}

/* Step distance */
.step-info {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 4px;
}
.step-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}
.step-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-tertiary);
  min-width: 40px;
}
.step-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-on-surface-variant);
}
.step-f5-btn {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid var(--color-tertiary);
  border-radius: 4px;
  background: none;
  color: var(--color-tertiary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.step-f5-btn:hover { background: rgba(255,255,255,0.06); }

/* Home & Zero buttons */
.jog-actions {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline-variant);
}

.action-btn {
  padding: 6px 10px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s, border-color 0.15s;
}
.action-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.action-btn.home {
  width: 100%;
  justify-content: center;
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.action-btn.home:hover:not(:disabled) {
  background: rgba(173,199,255,0.12);
}
.action-btn.zero {
  flex: 1;
  min-width: 0;
  justify-content: center;
}
.action-btn .material-symbols-outlined { font-size: 14px; }

.speed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.speed-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.speed-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.speed-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-outline-variant);
  border-radius: 2px;
  margin: 8px 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
}

.speed-ticks {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
}

/* G-code */
.gcode-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  height: 192px;
  display: flex;
  flex-direction: column;
}

.gcode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 8px;
}

.gcode-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.gcode-icon {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.gcode-list {
  flex: 1;
  overflow-y: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gcode-list::-webkit-scrollbar { width: 4px; }
.gcode-list::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 2px; }

.gcode-line {
  display: flex;
  gap: 16px;
}

.gcode-line.dim {
  color: var(--color-on-surface-variant);
  opacity: 0.4;
}

.gcode-line.active {
  color: var(--color-primary);
  background: rgba(173, 199, 255, 0.1);
  padding: 0 4px;
  border-radius: 2px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
</style>
