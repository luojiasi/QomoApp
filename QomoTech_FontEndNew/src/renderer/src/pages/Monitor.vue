<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useL10n } from '../shared/l10n'
import {
  startCameraReceiver,
  stopCameraReceiver,
  refreshCameraStream,
  useCameraReceiverState,
  connectCamera,
  disconnectCamera,
  fetchCameraDevices,
  getCameraStatus,
  setCameraExposure,
  setCameraFrameSpeed,
  setCameraMirror,
  setCameraWhiteBalance,
  bootstrapCameraSettings
} from '../shared/camera'
import type { CameraDeviceInfo, CameraFrameSpeedLevel, CameraStatusPayload } from '../shared/camera'
import {
  useHardwareState,
  startHardwareMonitor,
  stopHardwareMonitor
} from '../shared/motion'

const { t } = useL10n()
const { frameUrl, lastError } = useCameraReceiverState()
const { mposition } = useHardwareState()

// Camera state
const cameraStatus = ref<CameraStatusPayload | null>(null)
const devices = ref<CameraDeviceInfo[]>([])
const busy = ref(false)
const statusMsg = ref('')

// Editable params (live, not saved until Apply)
const editExposure = ref(1000)
const editAutoExposure = ref(true)
const editSpeedLevel = ref<CameraFrameSpeedLevel>(1)
const editAutoTune = ref(true)
const editTune = ref(1)
const editMirrorH = ref(false)
const editMirrorV = ref(false)
const editAutoWB = ref(true)
const editRGain = ref(21)
const editGGain = ref(22)
const editBGain = ref(16)

const selectedDeviceIndex = ref(0)

function formatPosition(val: number | undefined | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-'
  return val.toFixed(3)
}

async function refreshDevices() {
  const res = await fetchCameraDevices()
  if (res.success && res.data) {
    const data = res.data as { devices: CameraDeviceInfo[] }
    devices.value = data.devices ?? []
  }
}

async function refreshStatus() {
  const res = await getCameraStatus()
  if (res.success && res.data) {
    cameraStatus.value = res.data
  }
}

async function handleConnect() {
  busy.value = true
  statusMsg.value = ''
  try {
    await bootstrapCameraSettings({
      auto_exposure: editAutoExposure.value,
      exposure_time: editExposure.value,
      speed_level: editSpeedLevel.value,
      auto_tune: editAutoTune.value,
      tune: editTune.value,
      mirror_horizontal: editMirrorH.value,
      mirror_vertical: editMirrorV.value,
      auto_white_balance: editAutoWB.value,
      r_gain: editRGain.value,
      g_gain: editGGain.value,
      b_gain: editBGain.value
    })
    const res = await connectCamera(selectedDeviceIndex.value)
    if (res.success) {
      cameraStatus.value = res.data ?? null
      statusMsg.value = 'connected'
    } else {
      statusMsg.value = res.message ?? 'connect failed'
    }
  } catch {
    statusMsg.value = 'connect error'
  }
  busy.value = false
}

async function handleDisconnect() {
  busy.value = true
  try {
    const res = await disconnectCamera()
    if (res.success && res.data) {
      cameraStatus.value = res.data as CameraStatusPayload
    }
  } catch { /* ignore */ }
  busy.value = false
}

async function applyExposure() {
  await setCameraExposure({
    auto_exposure: editAutoExposure.value,
    exposure_time: editExposure.value
  })
  await refreshStatus()
}

async function applyFrameSpeed() {
  await setCameraFrameSpeed({
    speed_level: editSpeedLevel.value,
    auto_tune: editAutoTune.value,
    tune: editTune.value
  })
  await refreshStatus()
}

async function applyMirror() {
  await setCameraMirror({
    horizontal: editMirrorH.value,
    vertical: editMirrorV.value
  })
  await refreshStatus()
}

async function applyWhiteBalance() {
  await setCameraWhiteBalance({
    auto_white_balance: editAutoWB.value,
    r_gain: editRGain.value,
    g_gain: editGGain.value,
    b_gain: editBGain.value
  })
  await refreshStatus()
}

async function applyWhiteBalanceOnce() {
  await setCameraWhiteBalance({ once: true })
  await refreshStatus()
}

const isConnected = computed(() => cameraStatus.value?.connected ?? false)

onMounted(() => {
  startCameraReceiver()
  startHardwareMonitor()
  refreshDevices()
  refreshStatus()
})

onUnmounted(() => {
  stopCameraReceiver()
  stopHardwareMonitor()
})
</script>

<template>
  <div class="monitor-page">
    <div class="video-feed" @dblclick="refreshCameraStream()">
      <!-- Camera stream -->
      <img
        v-if="frameUrl"
        :src="frameUrl"
        alt="camera"
        class="camera-frame"
        draggable="false"
        @error="refreshCameraStream()"
      />
      <div v-else class="video-placeholder">
        <span class="video-text">{{ t('monitor.videoPlaceholder') }}</span>
      </div>

      <!-- Crosshair overlay -->
      <div class="crosshair-overlay">
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
        <div class="crosshair-ring ring-1"></div>
        <div class="crosshair-ring ring-2"></div>
        <div class="crosshair-center"></div>
      </div>

      <!-- Top-left HUD -->
      <div class="hud-top-left">
        <div class="hud-card">
          <div class="hud-label">{{ t('monitor.cameraFeed') }}</div>
          <div class="hud-value">{{ cameraStatus?.streaming ? 'LIVE' : '--' }}</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">{{ t('monitor.resolution') }}</div>
          <div class="hud-value">--</div>
        </div>
      </div>

      <!-- Bottom-left coordinates from motion -->
      <div class="hud-bottom-left">
        <div class="coords-header">
          <span class="material-symbols-outlined coords-icon">location_searching</span>
          <span class="coords-title">{{ t('monitor.coordinates') }}</span>
        </div>
        <div class="coords-grid">
          <div class="coord">
            <div class="coord-label">X</div>
            <div class="coord-value">{{ formatPosition(mposition['X']) }}</div>
          </div>
          <div class="coord">
            <div class="coord-label">Y</div>
            <div class="coord-value">{{ formatPosition(mposition['Y']) }}</div>
          </div>
          <div class="coord">
            <div class="coord-label">Z</div>
            <div class="coord-value">{{ formatPosition(mposition['Z']) }}</div>
          </div>
        </div>
      </div>

      <!-- Bottom-right status -->
      <div class="hud-bottom-right">
        <div class="status-group">
          <div class="status-label">{{ t('monitor.laserStatus') }}</div>
          <div class="status-row">
            <span class="status-dot" :class="{ on: isConnected }"></span>
            <span class="status-text">{{ isConnected ? t('monitor.connected') : t('monitor.disconnected') }}</span>
          </div>
        </div>
        <div class="status-divider"></div>
        <div class="status-group">
          <div class="status-label">{{ t('monitor.gasPressure') }}</div>
          <div class="status-value">-- BAR</div>
        </div>
      </div>

      <!-- Error overlay -->
      <div v-if="lastError" class="error-overlay">
        {{ lastError }}
      </div>
    </div>

    <!-- Camera sidebar -->
    <aside class="camera-sidebar">
      <h3 class="sidebar-title">
        <span class="material-symbols-outlined">tune</span>
        {{ t('monitor.cameraParams') }}
      </h3>

      <!-- Connection -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">{{ t('monitor.cameraDevice') }}</label>
          <span class="status-dot-sm" :class="{ on: isConnected }"></span>
        </div>
        <div class="connect-row">
          <select v-model.number="selectedDeviceIndex" class="field-input flex-1" :disabled="isConnected">
            <option v-for="d in devices" :key="d.index" :value="d.index">{{ d.name }}</option>
            <option v-if="devices.length === 0" :value="0">No devices</option>
          </select>
          <button v-if="!isConnected" class="btn-sm btn-primary" @click="handleConnect" :disabled="busy">
            {{ t('monitor.connect') }}
          </button>
          <button v-else class="btn-sm btn-error" @click="handleDisconnect" :disabled="busy">
            {{ t('monitor.disconnect') }}
          </button>
        </div>
        <span v-if="statusMsg" class="status-msg">{{ statusMsg }}</span>
      </div>

      <!-- Exposure -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">{{ t('monitor.exposure') }}</label>
          <span class="param-value">{{ editExposure }}</span>
        </div>
        <div class="param-row">
          <label class="checkbox-label">
            <input v-model="editAutoExposure" type="checkbox" />
            {{ t('monitor.autoExposure') }}
          </label>
        </div>
        <input v-model.number="editExposure" type="range" min="1" max="65535" class="param-slider" :disabled="editAutoExposure" />
        <div class="param-range-labels">
          <span>1</span>
          <span>65535</span>
        </div>
        <button class="btn-sm btn-secondary" @click="applyExposure">{{ t('monitor.apply') }}</button>
      </div>

      <!-- Frame Speed -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">{{ t('monitor.frameSpeed') }}</label>
          <span class="param-value">Lv{{ editSpeedLevel }}</span>
        </div>
        <select v-model.number="editSpeedLevel" class="field-input">
          <option :value="0">0 — HIGHEST</option>
          <option :value="1">1 — HIGH</option>
          <option :value="2">2 — LOW</option>
          <option :value="3">3 — LOWEST</option>
        </select>
        <div class="param-row">
          <label class="checkbox-label">
            <input v-model="editAutoTune" type="checkbox" />
            {{ t('monitor.autoTune') }}
          </label>
        </div>
        <input v-model.number="editTune" type="range" min="0" max="1" step="0.01" class="param-slider" :disabled="editAutoTune" />
        <button class="btn-sm btn-secondary" @click="applyFrameSpeed">{{ t('monitor.apply') }}</button>
      </div>

      <!-- Mirror -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">{{ t('monitor.mirror') }}</label>
        </div>
        <div class="param-row">
          <label class="checkbox-label">
            <input v-model="editMirrorH" type="checkbox" />
            {{ t('monitor.mirrorHorizontal') }}
          </label>
        </div>
        <div class="param-row">
          <label class="checkbox-label">
            <input v-model="editMirrorV" type="checkbox" />
            {{ t('monitor.mirrorVertical') }}
          </label>
        </div>
        <button class="btn-sm btn-secondary" @click="applyMirror">{{ t('monitor.apply') }}</button>
      </div>

      <!-- White Balance -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">{{ t('monitor.whiteBalance') }}</label>
        </div>
        <div class="param-row">
          <label class="checkbox-label">
            <input v-model="editAutoWB" type="checkbox" />
            {{ t('monitor.autoWhiteBalance') }}
          </label>
        </div>
        <div v-if="!editAutoWB" class="wb-gains">
          <div class="field">
            <label class="field-label">R</label>
            <input v-model.number="editRGain" type="number" class="field-input" min="0" max="65535" />
          </div>
          <div class="field">
            <label class="field-label">G</label>
            <input v-model.number="editGGain" type="number" class="field-input" min="0" max="65535" />
          </div>
          <div class="field">
            <label class="field-label">B</label>
            <input v-model.number="editBGain" type="number" class="field-input" min="0" max="65535" />
          </div>
        </div>
        <div class="wb-actions">
          <button class="btn-sm btn-secondary" @click="applyWhiteBalance">{{ t('monitor.apply') }}</button>
          <button class="btn-sm btn-outline" @click="applyWhiteBalanceOnce">{{ t('monitor.onceWhiteBalance') }}</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="sidebar-actions">
        <button class="action-btn primary" @click="refreshCameraStream()">
          <span class="material-symbols-outlined">refresh</span>
          {{ t('monitor.refreshStream') }}
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.video-feed {
  flex: 1;
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.camera-frame {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--color-outline-variant);
  letter-spacing: 0.2em;
}

/* Crosshair */
.crosshair-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.crosshair-h, .crosshair-v {
  position: absolute;
  background: rgba(173, 199, 255, 0.4);
}

.crosshair-h { width: 100%; height: 1px; }
.crosshair-v { width: 1px; height: 100%; }

.crosshair-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
}

.ring-1 {
  width: 64px;
  height: 64px;
  border-color: rgba(173, 199, 255, 0.3);
}

.ring-2 {
  width: 192px;
  height: 192px;
  border-color: rgba(173, 199, 255, 0.1);
}

.crosshair-center {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(173, 199, 255, 0.8);
}

/* HUD */
.hud-top-left {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hud-card {
  background: rgba(28, 32, 39, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 4px;
}

.hud-label {
  font-size: 10px;
  color: rgba(173, 199, 255, 0.7);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.hud-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.hud-bottom-left {
  position: absolute;
  bottom: 24px;
  left: 24px;
  max-width: 240px;
  background: rgba(28, 32, 39, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  border-radius: 4px;
}

.coords-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.coords-icon { color: var(--color-primary); font-size: 16px; }

.coords-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.coords-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.coord-label {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
}

.coord-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.hud-bottom-right {
  position: absolute;
  bottom: 24px;
  right: 340px;
  display: flex;
  align-items: center;
  gap: 24px;
  background: rgba(28, 32, 39, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  border-radius: 4px;
}

.status-group {
  display: flex;
  flex-direction: column;
}

.status-label {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-outline-variant);
}

.status-dot.on {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  animation: pulse-dot 2s infinite ease-in-out;
}

.status-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-error);
}

.status-text.on { color: #22c55e; }

.status-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.status-divider {
  width: 1px;
  height: 32px;
  background: var(--color-outline-variant);
}

.error-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(220, 38, 38, 0.7);
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

/* Camera sidebar */
.camera-sidebar {
  width: 320px;
  background: rgba(28, 32, 39, 0.6);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--color-outline-variant);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.sidebar-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 8px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.param-value {
  font-size: 13px;
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  accent-color: var(--color-primary);
}

.param-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-surface-variant);
  height: 4px;
  border-radius: 2px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.param-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
}

.param-slider:disabled { opacity: 0.3; cursor: not-allowed; }

.param-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
}

.connect-row {
  display: flex;
  gap: 8px;
}

.status-dot-sm {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error);
}

.status-dot-sm.on {
  background: #22c55e;
}

.status-msg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-error);
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}

.field-input {
  padding: 8px 10px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  outline: none;
}

.field-input:focus { border-color: var(--color-primary); }
.field-input:disabled { opacity: 0.5; cursor: not-allowed; }

.flex-1 { flex: 1; }

.wb-gains {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.wb-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn-sm {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.btn-sm:hover { opacity: 0.85; }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.btn-error {
  background: var(--color-error-container);
  color: var(--color-on-error-container);
}

.btn-outline {
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
}

.sidebar-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.action-btn:hover { opacity: 0.9; }
.action-btn:active { transform: scale(0.95); }

.action-btn.primary {
  background: var(--color-primary);
  color: var(--color-on-primary-container);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
</style>
