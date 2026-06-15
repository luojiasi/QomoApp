<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  startHardwareMonitor,
  stopHardwareMonitor,
  useHardwareState,
  jogAxis,
  jogStop,
  estop,
  connectMotion,
  disconnectMotion,
  setMotionAllAxesParams,
  buildMotionAllAxesParamsPayload,
  getControllerSettings,
  defaultControllerParameters
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
const gcodeLines = ref<GCmdLine[]>([
  { line: 'N120', code: 'G00 X0.00 Y0.00', active: false },
  { line: 'N125', code: 'G43 H01 Z50.00', active: false },
  { line: 'N130', code: 'G01 Z-5.00 F1000', active: true },
  { line: 'N135', code: 'G02 X20.00 Y20.00 R10.00', active: false },
  { line: 'N140', code: 'G01 X50.00', active: false },
  { line: 'N145', code: 'M08', active: false }
])

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
          <div class="jog-dial-outer">
            <div class="jog-dial-ring"></div>
          </div>
          <div class="jog-dial-inner">
            <div class="jog-glow"></div>
            <div class="jog-grid">
              <button
                class="jog-btn jog-top"
                :class="{ active: jogDir.Y > 0 }"
                @mousedown="startJog('Y', 1)"
                @mouseup="stopJog('Y')"
                @mouseleave="jogDir.Y > 0 ? stopJog('Y') : undefined"
                :disabled="!controllerConnected"
              >
                <span class="material-symbols-outlined jog-arrow">arrow_drop_up</span>
              </button>
              <button
                class="jog-btn jog-left"
                :class="{ active: jogDir.X < 0 }"
                @mousedown="startJog('X', -1)"
                @mouseup="stopJog('X')"
                @mouseleave="jogDir.X < 0 ? stopJog('X') : undefined"
                :disabled="!controllerConnected"
              >
                <span class="material-symbols-outlined jog-arrow">arrow_left</span>
              </button>
              <div class="jog-center"><div class="jog-center-dot"></div></div>
              <button
                class="jog-btn jog-right"
                :class="{ active: jogDir.X > 0 }"
                @mousedown="startJog('X', 1)"
                @mouseup="stopJog('X')"
                @mouseleave="jogDir.X > 0 ? stopJog('X') : undefined"
                :disabled="!controllerConnected"
              >
                <span class="material-symbols-outlined jog-arrow">arrow_right</span>
              </button>
              <button
                class="jog-btn jog-bottom"
                :class="{ active: jogDir.Y < 0 }"
                @mousedown="startJog('Y', -1)"
                @mouseup="stopJog('Y')"
                @mouseleave="jogDir.Y < 0 ? stopJog('Y') : undefined"
                :disabled="!controllerConnected"
              >
                <span class="material-symbols-outlined jog-arrow">arrow_drop_down</span>
              </button>
            </div>
          </div>
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
            <span class="material-symbols-outlined">arrow_upward</span>
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
            <span class="material-symbols-outlined">arrow_downward</span>
          </button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.jog-dial-outer {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 4px solid rgba(65, 71, 84, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.jog-dial-ring {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, var(--color-primary), transparent);
  animation: spin-ring 4s linear infinite;
  opacity: 0.2;
}

@keyframes spin-ring {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.jog-dial-inner {
  position: relative;
  width: 160px;
  height: 160px;
  background: var(--color-surface-container-highest);
  border: 2px solid var(--color-outline-variant);
  border-radius: 50%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.jog-glow {
  position: absolute;
  width: 48px;
  height: 48px;
  background: var(--color-primary);
  border-radius: 50%;
  filter: blur(24px);
  opacity: 0;
  transition: opacity 0.2s;
}

.jog-dial-inner:hover .jog-glow { opacity: 0.2; }

.jog-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
  z-index: 1;
}

.jog-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.jog-btn:hover:not(:disabled) { background: rgba(173, 199, 255, 0.1); }
.jog-btn.active { background: rgba(173, 199, 255, 0.2); }
.jog-btn.active .jog-arrow { color: var(--color-primary); }
.jog-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.jog-top { grid-column: 2; }
.jog-left { grid-column: 1; grid-row: 2; }
.jog-center { grid-column: 2; grid-row: 2; display: flex; align-items: center; justify-content: center; }
.jog-right { grid-column: 3; grid-row: 2; }
.jog-bottom { grid-column: 2; grid-row: 3; }

.jog-arrow {
  color: var(--color-on-surface);
  cursor: pointer;
  transition: color 0.2s;
  font-size: 28px;
}

.jog-center-dot {
  width: 20px;
  height: 20px;
  background: var(--color-primary);
  border-radius: 50%;
  border: 3px solid var(--color-surface-container-high);
}

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
  margin-top: auto;
  padding-top: 24px;
  border-top: 1px solid var(--color-outline-variant);
}

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
