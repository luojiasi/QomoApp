<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { useL10n } from '../shared/l10n'
import {
  useHardwareState,
  startHardwareMonitor,
  stopHardwareMonitor,
  getControllerSettings,
  saveControllerSettings,
  connectMotion,
  disconnectMotion,
  setMotionAllAxesParams,
  buildMotionAllAxesParamsPayload,
  defaultControllerParameters,
  applyControllerAxisCount,
  AXIS_TAB_LABELS
} from '../shared/motion'
import type {
  ControllerParameters,
  ControllerAxisUserInput,
  ControllerAxisCount
} from '../shared/motion'

const { t } = useL10n()
const { controllerConnected, wsConnected } = useHardwareState()

const settings = reactive<ControllerParameters>(JSON.parse(JSON.stringify(defaultControllerParameters)))
const editAxes = reactive<ControllerAxisUserInput[]>(
  JSON.parse(JSON.stringify(defaultControllerParameters.axes))
)
const saveStatus = ref('')
const loadStatus = ref('')
const bootstrapStatus = ref('')
const isConnecting = ref(false)
const isSaving = ref(false)
const activeAxisTab = ref(0)

const axisCount = ref<ControllerAxisCount>(5)

function syncEditAxes() {
  editAxes.length = 0
  for (const a of settings.axes) {
    editAxes.push({ ...JSON.parse(JSON.stringify(a)) })
  }
}

function applyEditAxes() {
  for (let i = 0; i < settings.axes.length; i++) {
    Object.assign(settings.axes[i], JSON.parse(JSON.stringify(editAxes[i])))
  }
}

async function handleLoad() {
  loadStatus.value = 'loading'
  try {
    const res = await getControllerSettings()
    if (res.success && res.data) {
      const data = res.data as ControllerParameters
      if (data.communication && data.axes) {
        Object.assign(settings.communication, data.communication)
        settings.axes.length = 0
        for (const a of data.axes) {
          settings.axes.push({ ...a })
        }
        axisCount.value = settings.communication.axis_count
        syncEditAxes()
        loadStatus.value = 'ok'
      } else {
        loadStatus.value = 'empty'
      }
    } else {
      loadStatus.value = 'empty'
    }
  } catch {
    loadStatus.value = 'error'
  }
}

async function handleSave() {
  isSaving.value = true
  saveStatus.value = 'saving'
  try {
    applyEditAxes()
    const res = await saveControllerSettings(JSON.parse(JSON.stringify(settings)))
    saveStatus.value = res.success ? 'ok' : 'error'
  } catch {
    saveStatus.value = 'error'
  }
  isSaving.value = false
}

async function handleBootstrap() {
  isConnecting.value = true
  bootstrapStatus.value = 'connecting'
  try {
    await connectMotion(settings.communication.controller_ip)
    bootstrapStatus.value = 'pushing'
    const payload = buildMotionAllAxesParamsPayload(settings)
    await setMotionAllAxesParams(payload)
    bootstrapStatus.value = 'ok'
  } catch {
    bootstrapStatus.value = 'error'
  }
  isConnecting.value = false
}

async function handleDisconnect() {
  await disconnectMotion()
}

function handleAxisCountChange(count: ControllerAxisCount) {
  axisCount.value = count
  applyEditAxes()
  const updated = applyControllerAxisCount(settings, count)
  Object.assign(settings.communication, updated.communication)
  settings.axes.length = 0
  for (const a of updated.axes) {
    settings.axes.push({ ...a })
  }
  syncEditAxes()
}

onMounted(() => {
  startHardwareMonitor()
  handleLoad()
})

onUnmounted(() => {
  stopHardwareMonitor()
})
</script>

<template>
  <div class="controller-settings-page">
    <div class="page-header">
      <h2 class="page-title">{{ t('controllerSettings.title') }}</h2>
      <div class="header-status">
        <span class="status-badge" :class="controllerConnected ? 'connected' : 'disconnected'">
          <span class="status-dot"></span>
          {{ controllerConnected ? t('controllerSettings.controllerConnected') : t('controllerSettings.controllerDisconnected') }}
        </span>
        <span class="status-badge" :class="wsConnected ? 'connected' : 'disconnected'">
          <span class="status-dot"></span>
          {{ wsConnected ? t('controllerSettings.wsConnected') : t('controllerSettings.wsDisconnected') }}
        </span>
      </div>
    </div>

    <!-- Communication settings -->
    <section class="section">
      <h3 class="section-title">{{ t('controllerSettings.commParams') }}</h3>
      <div class="comm-grid">
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.controllerModel') }}</label>
          <input v-model="settings.communication.controller_model" class="field-input" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.controllerIp') }}</label>
          <input v-model="settings.communication.controller_ip" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.connectTimeout') }}</label>
          <input v-model.number="settings.communication.connect_timeout_s" type="number" class="field-input" step="0.5" min="1" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.axisCount') }}</label>
          <div class="axis-count-toggle">
            <button
              v-for="cnt in ([3, 5] as ControllerAxisCount[])"
              :key="cnt"
              class="toggle-btn"
              :class="{ active: axisCount === cnt }"
              @click="handleAxisCountChange(cnt)"
            >
              {{ cnt }} 轴 ({{ AXIS_TAB_LABELS[cnt].join('') }})
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Axis parameters -->
    <section class="section">
      <h3 class="section-title">{{ t('controllerSettings.axisParams') }}</h3>
      <div class="axis-tabs">
        <button
          v-for="(axis, idx) in editAxes"
          :key="axis.axis_no"
          class="axis-tab"
          :class="{ active: activeAxisTab === idx }"
          @click="activeAxisTab = idx"
        >
          {{ axis.axis_name }}-Axis
        </button>
      </div>

      <div v-if="editAxes[activeAxisTab]" class="axis-params-grid">
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.axisNo') }}</label>
          <input v-model.number="editAxes[activeAxisTab].axis_no" type="number" class="field-input" disabled />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.axisName') }}</label>
          <input v-model="editAxes[activeAxisTab].axis_name" class="field-input" disabled />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.axisType') }}</label>
          <input v-model.number="editAxes[activeAxisTab].axis_type" type="number" class="field-input" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.motorType') }}</label>
          <select v-model="editAxes[activeAxisTab].motor_type" class="field-input">
            <option value="servo">{{ t('controllerSettings.servo') }}</option>
            <option value="stepper">{{ t('controllerSettings.stepper') }}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.units') }}</label>
          <input v-model.number="editAxes[activeAxisTab].units" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.speed') }}</label>
          <input v-model.number="editAxes[activeAxisTab].speed" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.lspeed') }}</label>
          <input v-model.number="editAxes[activeAxisTab].lspeed" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.accel') }}</label>
          <input v-model.number="editAxes[activeAxisTab].accel" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.decel') }}</label>
          <input v-model.number="editAxes[activeAxisTab].decel" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.sramp') }}</label>
          <input v-model.number="editAxes[activeAxisTab].sramp" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.creep') }}</label>
          <input v-model.number="editAxes[activeAxisTab].creep" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.merge') }}</label>
          <input v-model.number="editAxes[activeAxisTab].merge" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.fwdIn') }}</label>
          <input v-model.number="editAxes[activeAxisTab].fwd_in" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.revIn') }}</label>
          <input v-model.number="editAxes[activeAxisTab].rev_in" type="number" class="field-input mono" />
        </div>

        <template v-if="editAxes[activeAxisTab].motor_type === 'servo'">
          <div class="field">
            <label class="field-label">{{ t('controllerSettings.pulsesPerRev') }}</label>
            <input v-model.number="editAxes[activeAxisTab].pulses_per_rev" type="number" class="field-input mono" />
          </div>
          <div class="field">
            <label class="field-label">{{ t('controllerSettings.electronicGearRatio') }}</label>
            <input v-model.number="editAxes[activeAxisTab].electronic_gear_ratio" type="number" class="field-input mono" />
          </div>
          <div class="field">
            <label class="field-label">{{ t('controllerSettings.gearRatio') }}</label>
            <input v-model.number="editAxes[activeAxisTab].gear_ratio" type="number" class="field-input mono" />
          </div>
        </template>
        <template v-else>
          <div class="field">
            <label class="field-label">{{ t('controllerSettings.stepAngle') }}</label>
            <input v-model.number="editAxes[activeAxisTab].step_angle" type="number" class="field-input mono" />
          </div>
          <div class="field">
            <label class="field-label">{{ t('controllerSettings.microsteps') }}</label>
            <input v-model.number="editAxes[activeAxisTab].microsteps" type="number" class="field-input mono" />
          </div>
        </template>

        <div class="field">
          <label class="field-label">{{ t('controllerSettings.backlash') }}</label>
          <input v-model.number="editAxes[activeAxisTab].backlash" type="number" class="field-input mono" />
        </div>
        <div class="field field-checkbox">
          <label class="field-label">{{ t('controllerSettings.backlashEnable') }}</label>
          <input v-model="editAxes[activeAxisTab].backlash_enable" type="checkbox" />
        </div>
      </div>
    </section>

    <!-- Merge params -->
    <section class="section" v-if="editAxes[activeAxisTab]">
      <h3 class="section-title">{{ t('controllerSettings.mergeParamsTitle') }} — {{ editAxes[activeAxisTab].axis_name }}</h3>
      <div class="merge-grid">
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.cornerMode') }}</label>
          <input v-model.number="editAxes[activeAxisTab].merge_params.corner_mode" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.decelAngle') }}</label>
          <input v-model.number="editAxes[activeAxisTab].merge_params.decel_angle" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.stopAngle') }}</label>
          <input v-model.number="editAxes[activeAxisTab].merge_params.stop_angle" type="number" class="field-input mono" />
        </div>
        <div class="field">
          <label class="field-label">{{ t('controllerSettings.zxmooth') }}</label>
          <input v-model.number="editAxes[activeAxisTab].merge_params.zxmooth" type="number" class="field-input mono" />
        </div>
      </div>
    </section>

    <!-- Actions -->
    <section class="section actions-section">
      <div class="action-row">
        <div class="action-group">
          <button class="btn btn-primary" @click="handleLoad" :disabled="loadStatus === 'loading'">
            <span class="material-symbols-outlined">folder_open</span>
            {{ t('controllerSettings.loadFromFile') }}
          </button>
          <button class="btn btn-primary" @click="handleSave" :disabled="isSaving">
            <span class="material-symbols-outlined">save</span>
            {{ t('controllerSettings.saveToFile') }}
          </button>
          <span v-if="loadStatus === 'ok'" class="status-text status-ok">{{ t('controllerSettings.loadSuccess') }}</span>
          <span v-if="loadStatus === 'empty'" class="status-text">{{ t('controllerSettings.loadEmpty') }}</span>
          <span v-if="loadStatus === 'error'" class="status-text status-error">{{ t('controllerSettings.loadFailed') }}</span>
          <span v-if="saveStatus === 'saving'" class="status-text status-loading">{{ t('controllerSettings.saving') }}</span>
          <span v-if="saveStatus === 'ok'" class="status-text status-ok">{{ t('controllerSettings.saveSuccess') }}</span>
          <span v-if="saveStatus === 'error'" class="status-text status-error">{{ t('controllerSettings.saveFailed') }}</span>
        </div>
        <div class="action-divider"></div>
        <div class="action-group">
          <button class="btn btn-accent" @click="handleBootstrap" :disabled="isConnecting">
            <span class="material-symbols-outlined">rocket_launch</span>
            {{ t('controllerSettings.bootstrap') }}
          </button>
          <button class="btn btn-outline" @click="handleDisconnect" :disabled="!controllerConnected">
            <span class="material-symbols-outlined">link_off</span>
            {{ t('controllerSettings.disconnect') }}
          </button>
          <span v-if="bootstrapStatus === 'connecting'" class="status-text status-loading">{{ t('controllerSettings.connecting') }}</span>
          <span v-if="bootstrapStatus === 'pushing'" class="status-text status-loading">{{ t('controllerSettings.pushing') }}</span>
          <span v-if="bootstrapStatus === 'ok'" class="status-text status-ok">{{ t('controllerSettings.bootstrapSuccess') }}</span>
          <span v-if="bootstrapStatus === 'error'" class="status-text status-error">{{ t('controllerSettings.bootstrapFailed') }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.controller-settings-page {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-on-background);
}

.header-status {
  display: flex;
  gap: 12px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
}

.status-badge.connected {
  border-color: #22c55e;
  color: #22c55e;
}

.status-badge.disconnected {
  border-color: var(--color-error);
  color: var(--color-error);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-error);
}

.connected .status-dot {
  background: #22c55e;
}

/* Sections */
.section {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
}

.section-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-outline-variant);
}

/* Fields */
.comm-grid,
.axis-params-grid,
.merge-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
}

.field-input {
  padding: 8px 10px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  color: var(--color-on-surface);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.field-input:focus {
  border-color: var(--color-primary);
}

.field-input.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-checkbox {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
}

.field-checkbox .field-label {
  flex: 1;
}

.field-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

select.field-input {
  cursor: pointer;
}

/* Axis count toggle */
.axis-count-toggle {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  flex: 1;
  padding: 8px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn.active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border-color: var(--color-primary);
}

/* Axis tabs */
.axis-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.axis-tab {
  padding: 6px 16px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;
}

.axis-tab.active {
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  border-color: var(--color-secondary);
}

/* Actions */
.actions-section {
  padding: 16px 20px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 24px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-divider {
  width: 1px;
  height: 40px;
  background: var(--color-outline-variant);
}

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn .material-symbols-outlined {
  font-size: 18px;
}

.btn-primary {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-accent {
  background: var(--color-tertiary-container);
  color: var(--color-on-tertiary-container);
}

.btn-accent:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-outline {
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}

/* Status text */
.status-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  margin-left: 4px;
}

.status-ok { color: #22c55e; }
.status-error { color: var(--color-error); }
.status-loading { color: var(--color-primary); animation: blink 1s infinite; }

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
