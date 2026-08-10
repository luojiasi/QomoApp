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
  <div class="cs-page">
    <header class="cs-top">
      <div class="cs-top-text">
        <h1 class="cs-title">{{ t('controllerSettings.title') }}</h1>
        <p class="cs-sub">{{ t('controllerSettings.subtitle') }}</p>
      </div>
      <div class="cs-badges">
        <span class="cs-badge" :class="controllerConnected ? 'on' : 'off'">
          <span class="cs-dot" />
          {{ controllerConnected ? t('controllerSettings.controllerConnected') : t('controllerSettings.controllerDisconnected') }}
        </span>
        <span class="cs-badge" :class="wsConnected ? 'on' : 'off'">
          <span class="cs-dot" />
          {{ wsConnected ? t('controllerSettings.wsConnected') : t('controllerSettings.wsDisconnected') }}
        </span>
      </div>
    </header>

    <div class="cs-scroll">
      <!-- Communication -->
      <section class="cs-card">
        <div class="cs-card-head">
          <div class="cs-panel-label">
            <span class="material-symbols-outlined">lan</span>
            {{ t('controllerSettings.commParams') }}
          </div>
        </div>
        <div class="cs-grid cs-grid-4">
          <div class="cs-field">
            <label class="cs-label">{{ t('controllerSettings.controllerModel') }}</label>
            <input v-model="settings.communication.controller_model" class="cs-input" />
          </div>
          <div class="cs-field">
            <label class="cs-label">{{ t('controllerSettings.controllerIp') }}</label>
            <input v-model="settings.communication.controller_ip" class="cs-input mono" />
          </div>
          <div class="cs-field">
            <label class="cs-label">{{ t('controllerSettings.connectTimeout') }}</label>
            <input
              v-model.number="settings.communication.connect_timeout_s"
              type="number"
              class="cs-input"
              step="0.5"
              min="1"
            />
          </div>
          <div class="cs-field">
            <label class="cs-label">{{ t('controllerSettings.axisCount') }}</label>
            <div class="cs-seg">
              <button
                v-for="cnt in ([3, 5] as ControllerAxisCount[])"
                :key="cnt"
                type="button"
                class="cs-seg-btn"
                :class="{ active: axisCount === cnt }"
                @click="handleAxisCountChange(cnt)"
              >
                {{ cnt }}{{ t('controllerSettings.axisUnit') }}
                <span class="cs-seg-meta">({{ AXIS_TAB_LABELS[cnt].join('') }})</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Axis workspace -->
      <section class="cs-card cs-axis-card">
        <div class="cs-card-head cs-card-head-row">
          <div class="cs-panel-label">
            <span class="material-symbols-outlined">tune</span>
            {{ t('controllerSettings.axisParams') }}
          </div>
          <div class="cs-axis-tabs" role="tablist">
            <button
              v-for="(axis, idx) in editAxes"
              :key="axis.axis_no"
              type="button"
              class="cs-axis-tab"
              role="tab"
              :class="{ active: activeAxisTab === idx }"
              :aria-selected="activeAxisTab === idx"
              @click="activeAxisTab = idx"
            >
              <span class="cs-axis-tab-name">{{ axis.axis_name }}</span>
              <span class="cs-axis-tab-no">#{{ axis.axis_no }}</span>
            </button>
          </div>
        </div>

        <div v-if="editAxes[activeAxisTab]" class="cs-axis-body">
          <!-- Basic -->
          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">info</span>
              {{ t('controllerSettings.groupBasic') }}
            </div>
            <div class="cs-grid cs-grid-4">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.axisNo') }}</label>
                <input v-model.number="editAxes[activeAxisTab].axis_no" type="number" class="cs-input" disabled />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.axisName') }}</label>
                <input v-model="editAxes[activeAxisTab].axis_name" class="cs-input" disabled />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.axisType') }}</label>
                <input v-model.number="editAxes[activeAxisTab].axis_type" type="number" class="cs-input" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.motorType') }}</label>
                <select v-model="editAxes[activeAxisTab].motor_type" class="cs-input">
                  <option value="servo">{{ t('controllerSettings.servo') }}</option>
                  <option value="stepper">{{ t('controllerSettings.stepper') }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Motion：三列一行 -->
          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">speed</span>
              {{ t('controllerSettings.groupMotion') }}
            </div>
            <div class="cs-grid cs-grid-3">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.units') }}</label>
                <input v-model.number="editAxes[activeAxisTab].units" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.speed') }}</label>
                <input v-model.number="editAxes[activeAxisTab].speed" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.lspeed') }}</label>
                <input v-model.number="editAxes[activeAxisTab].lspeed" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.accel') }}</label>
                <input v-model.number="editAxes[activeAxisTab].accel" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.decel') }}</label>
                <input v-model.number="editAxes[activeAxisTab].decel" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.sramp') }}</label>
                <input v-model.number="editAxes[activeAxisTab].sramp" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.creep') }}</label>
                <input v-model.number="editAxes[activeAxisTab].creep" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.merge') }}</label>
                <input v-model.number="editAxes[activeAxisTab].merge" type="number" class="cs-input mono" />
              </div>
            </div>
          </div>

          <!-- 限位输入 / 软限位：合并到一起 -->
          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">fence</span>
              {{ t('controllerSettings.groupLimit') }}
            </div>
            <div class="cs-grid cs-grid-2">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.fwdIn') }}</label>
                <input v-model.number="editAxes[activeAxisTab].fwd_in" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.revIn') }}</label>
                <input v-model.number="editAxes[activeAxisTab].rev_in" type="number" class="cs-input mono" />
              </div>
            </div>
            <div class="cs-section-divider" />
            <div class="cs-grid cs-grid-2">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.正软限位') }}</label>
                <input v-model.number="editAxes[activeAxisTab].正软限位" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.负软限位') }}</label>
                <input v-model.number="editAxes[activeAxisTab].负软限位" type="number" class="cs-input mono" />
              </div>
            </div>
          </div>

          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">precision_manufacturing</span>
              {{ t('controllerSettings.groupMotor') }}
            </div>
            <div v-if="editAxes[activeAxisTab].motor_type === 'servo'" class="cs-grid cs-grid-3">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.pulsesPerRev') }}</label>
                <input v-model.number="editAxes[activeAxisTab].pulses_per_rev" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.electronicGearRatio') }}</label>
                <input
                  v-model.number="editAxes[activeAxisTab].electronic_gear_ratio"
                  type="number"
                  class="cs-input mono"
                />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.gearRatio') }}</label>
                <input v-model.number="editAxes[activeAxisTab].gear_ratio" type="number" class="cs-input mono" />
              </div>
            </div>
            <div v-else class="cs-grid cs-grid-2">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.stepAngle') }}</label>
                <input v-model.number="editAxes[activeAxisTab].step_angle" type="number" class="cs-input mono" />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.microsteps') }}</label>
                <input v-model.number="editAxes[activeAxisTab].microsteps" type="number" class="cs-input mono" />
              </div>
            </div>
          </div>

          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">sync_alt</span>
              {{ t('controllerSettings.groupBacklash') }}
            </div>
            <div class="cs-grid cs-grid-2">
              <div class="cs-field cs-field-center">
                <label class="cs-check">
                  <input v-model="editAxes[activeAxisTab].backlash_enable" type="checkbox" />
                  <span>{{ t('controllerSettings.backlashEnable') }}</span>
                </label>
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.backlash') }}</label>
                <input v-model.number="editAxes[activeAxisTab].backlash" type="number" class="cs-input mono" />
              </div>
            </div>
          </div>

          <!-- Merge -->
          <div class="cs-subcard">
            <div class="cs-subcard-title">
              <span class="material-symbols-outlined">timeline</span>
              {{ t('controllerSettings.mergeParamsTitle') }}
              <span class="cs-subcard-tag">{{ editAxes[activeAxisTab].axis_name }}</span>
            </div>
            <div class="cs-grid cs-grid-4">
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.cornerMode') }}</label>
                <input
                  v-model.number="editAxes[activeAxisTab].merge_params.corner_mode"
                  type="number"
                  class="cs-input mono"
                />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.decelAngle') }}</label>
                <input
                  v-model.number="editAxes[activeAxisTab].merge_params.decel_angle"
                  type="number"
                  class="cs-input mono"
                />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.stopAngle') }}</label>
                <input
                  v-model.number="editAxes[activeAxisTab].merge_params.stop_angle"
                  type="number"
                  class="cs-input mono"
                />
              </div>
              <div class="cs-field">
                <label class="cs-label">{{ t('controllerSettings.zxmooth') }}</label>
                <input
                  v-model.number="editAxes[activeAxisTab].merge_params.zxmooth"
                  type="number"
                  class="cs-input mono"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <footer class="cs-footer">
      <div class="cs-footer-group">
        <button type="button" class="cs-btn" :disabled="loadStatus === 'loading'" @click="handleLoad">
          <span class="material-symbols-outlined">folder_open</span>
          {{ t('controllerSettings.loadFromFile') }}
        </button>
        <button type="button" class="cs-btn primary" :disabled="isSaving" @click="handleSave">
          <span class="material-symbols-outlined">save</span>
          {{ t('controllerSettings.saveToFile') }}
        </button>
        <span v-if="loadStatus === 'ok'" class="cs-status ok">{{ t('controllerSettings.loadSuccess') }}</span>
        <span v-if="loadStatus === 'empty'" class="cs-status">{{ t('controllerSettings.loadEmpty') }}</span>
        <span v-if="loadStatus === 'error'" class="cs-status err">{{ t('controllerSettings.loadFailed') }}</span>
        <span v-if="saveStatus === 'saving'" class="cs-status loading">{{ t('controllerSettings.saving') }}</span>
        <span v-if="saveStatus === 'ok'" class="cs-status ok">{{ t('controllerSettings.saveSuccess') }}</span>
        <span v-if="saveStatus === 'error'" class="cs-status err">{{ t('controllerSettings.saveFailed') }}</span>
      </div>
      <div class="cs-footer-divider" />
      <div class="cs-footer-group">
        <button type="button" class="cs-btn accent" :disabled="isConnecting" @click="handleBootstrap">
          <span class="material-symbols-outlined">rocket_launch</span>
          {{ t('controllerSettings.bootstrap') }}
        </button>
        <button
          type="button"
          class="cs-btn ghost"
          :disabled="!controllerConnected"
          @click="handleDisconnect"
        >
          <span class="material-symbols-outlined">link_off</span>
          {{ t('controllerSettings.disconnect') }}
        </button>
        <span v-if="bootstrapStatus === 'connecting'" class="cs-status loading">{{ t('controllerSettings.connecting') }}</span>
        <span v-if="bootstrapStatus === 'pushing'" class="cs-status loading">{{ t('controllerSettings.pushing') }}</span>
        <span v-if="bootstrapStatus === 'ok'" class="cs-status ok">{{ t('controllerSettings.bootstrapSuccess') }}</span>
        <span v-if="bootstrapStatus === 'error'" class="cs-status err">{{ t('controllerSettings.bootstrapFailed') }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.cs-page {
  --cs-radius: 12px;
  --cs-gap: 12px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 18px 14px;
  gap: var(--cs-gap);
  background:
    radial-gradient(1100px 380px at 8% -8%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 58%),
    color-mix(in srgb, var(--color-surface) 94%, transparent);
}

.cs-top {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.cs-top-text { min-width: 0; }
.cs-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-on-surface);
}
.cs-sub {
  margin: 4px 0 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.85;
}
.cs-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.cs-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 650;
  background: color-mix(in srgb, var(--color-surface-container) 88%, transparent);
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}
.cs-badge.on {
  border-color: color-mix(in srgb, #22c55e 55%, transparent);
  color: #4ade80;
  background: color-mix(in srgb, #22c55e 10%, transparent);
}
.cs-badge.off {
  border-color: color-mix(in srgb, var(--color-error) 45%, transparent);
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
}
.cs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.cs-scroll {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--cs-gap);
  padding-right: 4px;
}
.cs-scroll::-webkit-scrollbar {
  width: 8px;
}
.cs-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-outline-variant) 90%, var(--color-primary) 10%);
  border-radius: 4px;
}
.cs-scroll::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--color-surface-container) 60%, transparent);
  border-radius: 4px;
}

.cs-panel-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
.cs-panel-label .material-symbols-outlined {
  font-size: 16px;
  color: var(--color-primary);
}

.cs-card {
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: var(--cs-radius);
  background: color-mix(in srgb, var(--color-surface-container) 90%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: visible;
  min-width: 0;
}
.cs-card-head {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 40%),
    color-mix(in srgb, var(--color-surface-container-high) 55%, transparent);
  border-radius: var(--cs-radius) var(--cs-radius) 0 0;
}
.cs-card-head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cs-card > .cs-grid {
  padding: 14px;
}

/*
  表单网格：列宽有上下限，宽屏不把输入框拉成「一条巨长空框」；
  窄屏自动换行（auto-fill），避免被外层 overflow:hidden 裁切。
*/
.cs-grid {
  display: grid;
  gap: 12px;
  min-width: 0;
  width: 100%;
}
.cs-grid-1 {
  grid-template-columns: minmax(0, 280px);
}
.cs-grid-2,
.cs-grid-3,
.cs-grid-4 {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 280px));
}

.cs-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 280px;
}
.cs-field-center {
  align-items: center;
  justify-content: center;
}
.cs-field-center .cs-check {
  justify-content: center;
}
.cs-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.cs-input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 85%, transparent);
  background: color-mix(in srgb, var(--color-surface-container-lowest) 82%, transparent);
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.cs-input.mono { color: var(--color-primary); }
.cs-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.cs-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
select.cs-input { cursor: pointer; }

.cs-seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 0;
}
.cs-seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 34px;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cs-seg-meta {
  opacity: 0.7;
  font-weight: 600;
  white-space: nowrap;
}
.cs-seg-btn.active {
  background: color-mix(in srgb, var(--color-primary) 24%, transparent);
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
}

.cs-axis-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
  max-width: 100%;
}
.cs-axis-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cs-axis-tab-no {
  font-size: 10px;
  opacity: 0.65;
}
.cs-axis-tab.active {
  background: color-mix(in srgb, var(--color-primary) 22%, transparent);
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 42%, transparent);
}

.cs-axis-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.cs-subcard {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 75%, transparent);
  background: color-mix(in srgb, var(--color-surface-container-high) 35%, transparent);
  min-width: 0;
  overflow: visible;
}
.cs-subcard-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 650;
  color: var(--color-on-surface);
}
.cs-subcard-title .material-symbols-outlined {
  font-size: 16px;
  color: var(--color-primary);
}
.cs-subcard-tag {
  margin-left: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);
}

.cs-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}
.cs-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.cs-footer {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface-container) 88%, transparent);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.08);
  min-width: 0;
}
.cs-footer-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cs-footer-divider {
  width: 1px;
  align-self: stretch;
  min-height: 28px;
  background: var(--color-outline-variant);
}

.cs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
  white-space: nowrap;
}
.cs-btn .material-symbols-outlined { font-size: 16px; }
.cs-btn:active:not(:disabled) { transform: translateY(1px); }
.cs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cs-btn.primary {
  border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
}
.cs-btn.primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 26%, transparent);
}
.cs-btn.accent {
  border-color: color-mix(in srgb, var(--color-tertiary, var(--color-primary)) 40%, transparent);
  background: color-mix(in srgb, var(--color-tertiary, var(--color-primary)) 18%, transparent);
  color: var(--color-tertiary, var(--color-primary));
}
.cs-btn.ghost:hover:not(:disabled) {
  border-color: var(--color-error);
  color: var(--color-error);
}

.cs-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}
.cs-status.ok { color: #4ade80; }
.cs-status.err { color: var(--color-error); }
.cs-status.loading {
  color: var(--color-primary);
  animation: cs-blink 1s infinite;
}
@keyframes cs-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
