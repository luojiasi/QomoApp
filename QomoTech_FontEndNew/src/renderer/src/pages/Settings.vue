<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useL10n, getLocale, setLocale, type Locale } from '../shared/l10n'
import { themes, applyTheme } from '../shared/theme'
import { useKeyboardBindings, type KeyBinding, IO_OUTPUT_COUNT } from '../shared/motion'

const { t } = useL10n()
const { bindings, resetToDefaults, updateBinding } = useKeyboardBindings()

const motionBindings = computed(() => bindings.filter((b) => !b.isStep && !b.isIo))
const stepBindings = computed(() => bindings.filter((b) => b.isStep))

const ioRows = computed(() =>
  Array.from({ length: IO_OUTPUT_COUNT }, (_, i) => {
    const toggle = bindings.find((b) => b.isIo && !b.ioPulse && b.ioIndex === i)!
    const pulse = bindings.find((b) => b.isIo && b.ioPulse && b.ioIndex === i)!
    return { index: i, toggle, pulse }
  })
)

function ioLabel(n: number): string {
  return t('kbd.ioOut').replace('{n}', String(n))
}

function onPulseMsChange(id: string, event: Event) {
  const el = event.target as HTMLInputElement
  const v = parseFloat(el.value)
  if (!Number.isFinite(v)) return
  updateBinding(id, { pulseMs: v })
}

type SettingsTab = 'general' | 'update' | 'display' | 'keyboard' | 'system' | 'about'

const tabs: { id: SettingsTab; icon: string; titleKey: string }[] = [
  { id: 'general', icon: 'settings', titleKey: 'settings.general' },
  { id: 'update', icon: 'system_update', titleKey: 'settings.update' },
  { id: 'display', icon: 'palette', titleKey: 'settings.display' },
  { id: 'keyboard', icon: 'keyboard', titleKey: 'kbd.title' },
  { id: 'system', icon: 'info', titleKey: 'settings.systemInfo' },
  { id: 'about', icon: 'apartment', titleKey: 'settings.about' }
]

const activeTab = ref<SettingsTab>('general')

const appVersion = ref('')
const appName = ref('')
const platform = ref('')
const arch = ref('')
const updateUrl = ref('')
const appId = ref('')
const windowWidth = ref(0)
const windowHeight = ref(0)

const selectedLocale = ref<Locale>(getLocale())
const selectedTheme = ref<string>(
  localStorage.getItem('qomotech:theme') ?? themes[0].id
)

watch(selectedLocale, (val) => {
  setLocale(val)
})

watch(selectedTheme, (val) => {
  localStorage.setItem('qomotech:theme', val)
  applyTheme(val)
})

onMounted(async () => {
  const info = await window.api.system.getInfo()
  appName.value = info.appName
  appVersion.value = info.appVersion
  appId.value = info.appId
  platform.value = info.platform
  arch.value = info.arch
  windowWidth.value = info.windowWidth
  windowHeight.value = info.windowHeight
  updateUrl.value = info.updateUrl
  window.addEventListener('keydown', onRecordKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onRecordKeydown)
})

const checkingUpdate = ref(false)
const updateResult = ref<string | null>(null)

async function checkUpdate() {
  checkingUpdate.value = true
  updateResult.value = null
  try {
    const result = await window.api.update.check()
    if (result.success) {
      updateResult.value = result.updateInfo ? `${t('update.available')}: ${(result.updateInfo as any).version}` : t('update.alreadyLatest')
    } else {
      updateResult.value = `${t('update.checkFailed')}: ${result.error}`
    }
  } catch {
    updateResult.value = t('update.errorOccurred')
  } finally {
    checkingUpdate.value = false
  }
}

const recordingId = ref<string | null>(null)

function formatKey(b: KeyBinding): string {
  if (!b.key) return '—'
  const parts: string[] = []
  if (b.ctrl) parts.push('Ctrl')
  if (b.shift) parts.push('Shift')
  parts.push(b.key.length > 1 ? b.key.replace('Arrow', '').replace('Page', 'Pg') : b.key.toUpperCase())
  return parts.join(' + ')
}

function startRecord(id: string) {
  recordingId.value = id
}

function onRecordKeydown(e: KeyboardEvent) {
  if (!recordingId.value) return
  e.preventDefault()
  e.stopPropagation()
  const key = e.key
  if (key === 'Escape') { recordingId.value = null; return }
  if (key === 'Backspace' || key === 'Delete') {
    updateBinding(recordingId.value, { key: '', ctrl: false, shift: false })
    recordingId.value = null
    return
  }
  if (['Control', 'Shift', 'Alt', 'Meta', 'Tab'].includes(key)) return
  updateBinding(recordingId.value, {
    key,
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey
  })
  recordingId.value = null
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1 class="settings-title">{{ t('settings.title') }}</h1>
      <p class="settings-subtitle">{{ t('settings.subtitle') }}</p>
    </div>

    <div class="settings-body">
      <!-- Left nav 3 -->
      <nav class="settings-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="nav-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="material-symbols-outlined">{{ tab.icon }}</span>
          <span class="nav-label">{{ t(tab.titleKey) }}</span>
        </button>
      </nav>

      <!-- Right detail 7 -->
      <div class="settings-detail">
        <!-- General -->
        <section v-if="activeTab === 'general'" class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">settings</span>
            {{ t('settings.general') }}
          </h2>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appName') }}</span>
              <span class="setting-desc">{{ t('settings.appNameDesc') }}</span>
            </div>
            <div class="setting-value">{{ appName }}</div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appId') }}</span>
              <span class="setting-desc">{{ t('settings.appIdDesc') }}</span>
            </div>
            <div class="setting-value mono">{{ appId }}</div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.language') }}</span>
              <span class="setting-desc">{{ t('settings.languageDesc') }}</span>
            </div>
            <select v-model="selectedLocale" class="setting-select">
              <option value="zh-CN">{{ t('settings.languageOptions.zhCN') }}</option>
              <option value="zh-TW">{{ t('settings.languageOptions.zhTW') }}</option>
              <option value="en">{{ t('settings.languageOptions.en') }}</option>
              <option value="ja">{{ t('settings.languageOptions.ja') }}</option>
              <option value="ko">{{ t('settings.languageOptions.ko') }}</option>
            </select>
          </div>
        </section>

        <!-- Update -->
        <section v-else-if="activeTab === 'update'" class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">system_update</span>
            {{ t('settings.update') }}
          </h2>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.currentVersion') }}</span>
              <span class="setting-desc">{{ t('settings.currentVersionDesc') }}</span>
            </div>
            <div class="setting-value mono highlight">{{ appVersion }}</div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.updateServer') }}</span>
              <span class="setting-desc">{{ t('settings.updateServerDesc') }}</span>
            </div>
            <div class="setting-value mono">{{ updateUrl }}</div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.checkUpdate') }}</span>
              <span class="setting-desc">{{ t('settings.checkUpdateDesc') }}</span>
            </div>
            <button class="setting-btn" :disabled="checkingUpdate" @click="checkUpdate">
              <span class="material-symbols-outlined spin" v-if="checkingUpdate">sync</span>
              <span class="material-symbols-outlined" v-else>search</span>
              {{ checkingUpdate ? t('settings.checking') : t('settings.checkNow') }}
            </button>
          </div>

          <div class="update-result" v-if="updateResult" :class="{ error: updateResult.includes('失败') || updateResult.includes('错误') }">
            {{ updateResult }}
          </div>
        </section>

        <!-- Display -->
        <section v-else-if="activeTab === 'display'" class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">palette</span>
            {{ t('settings.display') }}
          </h2>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.theme') }}</span>
              <span class="setting-desc">{{ t('settings.themeDesc') }}</span>
            </div>
            <select v-model="selectedTheme" class="setting-select">
              <option v-for="theme in themes" :key="theme.id" :value="theme.id">
                {{ t(theme.nameKey) }}
              </option>
            </select>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.windowSize') }}</span>
              <span class="setting-desc">{{ t('settings.windowSizeDesc') }}</span>
            </div>
            <div class="setting-value mono">{{ windowWidth }} × {{ windowHeight }}</div>
          </div>
        </section>

        <!-- Keyboard -->
        <section v-else-if="activeTab === 'keyboard'" class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">keyboard</span>
            {{ t('kbd.title') }}
          </h2>
          <p class="kbd-desc">{{ t('kbd.desc') }}</p>

          <!-- Axis motion -->
          <div class="kbd-group tone-motion">
            <h3 class="kbd-group-title">
              <span class="kbd-group-badge">
                <span class="material-symbols-outlined">open_with</span>
              </span>
              <span class="kbd-group-text">
                <span class="kbd-group-name">{{ t('kbd.groupMotion') }}</span>
                <span class="kbd-group-count">{{ motionBindings.length }}</span>
              </span>
            </h3>
            <div class="kbd-grid">
              <div v-for="b in motionBindings" :key="b.id" class="kbd-row">
                <span class="kbd-label">{{ t(b.label) }}</span>
                <button
                  type="button"
                  class="kbd-key"
                  :class="{ recording: recordingId === b.id, unbound: !b.key }"
                  @click="startRecord(b.id)"
                >
                  {{ recordingId === b.id ? t('kbd.recording') : formatKey(b) }}
                </button>
              </div>
            </div>
          </div>

          <!-- IO outputs 0–9 -->
          <div class="kbd-group tone-io">
            <h3 class="kbd-group-title">
              <span class="kbd-group-badge">
                <span class="material-symbols-outlined">electrical_services</span>
              </span>
              <span class="kbd-group-text">
                <span class="kbd-group-name">{{ t('kbd.groupIo') }}</span>
                <span class="kbd-group-count">0–9</span>
              </span>
            </h3>
            <div class="io-table">
              <div class="io-header">
                <span>{{ t('kbd.ioColOut') }}</span>
                <span class="col-toggle">{{ t('kbd.ioColToggle') }}</span>
                <span class="col-pulse">{{ t('kbd.ioColPulse') }}</span>
                <span class="col-ms">{{ t('kbd.ioColPulseMs') }}</span>
              </div>
              <div
                v-for="row in ioRows"
                :key="row.index"
                class="io-row"
                :class="{ 'has-default': row.toggle.key || row.pulse.key }"
              >
                <div class="io-name">
                  <span class="io-index">{{ row.index }}</span>
                  <span class="io-name-text">{{ ioLabel(row.index) }}</span>
                </div>
                <button
                  type="button"
                  class="kbd-key key-toggle"
                  :class="{ recording: recordingId === row.toggle.id, unbound: !row.toggle.key }"
                  @click="startRecord(row.toggle.id)"
                >
                  {{ recordingId === row.toggle.id ? t('kbd.recording') : formatKey(row.toggle) }}
                </button>
                <button
                  type="button"
                  class="kbd-key key-pulse"
                  :class="{ recording: recordingId === row.pulse.id, unbound: !row.pulse.key }"
                  @click="startRecord(row.pulse.id)"
                >
                  {{ recordingId === row.pulse.id ? t('kbd.recording') : formatKey(row.pulse) }}
                </button>
                <div class="io-ms">
                  <input
                    type="number"
                    class="io-ms-input"
                    :value="row.pulse.pulseMs"
                    min="50"
                    max="60000"
                    step="50"
                    @change="onPulseMsChange(row.pulse.id, $event)"
                  />
                  <span class="io-ms-unit">ms</span>
                </div>
              </div>
            </div>
            <p class="kbd-hint">{{ t('kbd.ioClearHint') }}</p>
          </div>

          <!-- Step size -->
          <div class="kbd-group tone-step">
            <h3 class="kbd-group-title">
              <span class="kbd-group-badge">
                <span class="material-symbols-outlined">straighten</span>
              </span>
              <span class="kbd-group-text">
                <span class="kbd-group-name">{{ t('kbd.groupStep') }}</span>
                <span class="kbd-group-count">F1–F5</span>
              </span>
            </h3>
            <div class="kbd-grid">
              <div v-for="b in stepBindings" :key="b.id" class="kbd-row">
                <span class="kbd-label">{{ t(b.label) }}</span>
                <button
                  type="button"
                  class="kbd-key key-step"
                  :class="{ recording: recordingId === b.id, unbound: !b.key }"
                  @click="startRecord(b.id)"
                >
                  {{ recordingId === b.id ? t('kbd.recording') : formatKey(b) }}
                </button>
              </div>
            </div>
          </div>

          <button type="button" class="setting-btn secondary" @click="resetToDefaults">
            <span class="material-symbols-outlined">restart_alt</span>
            {{ t('kbd.reset') }}
          </button>
        </section>

        <!-- System -->
        <section v-else-if="activeTab === 'system'" class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">info</span>
            {{ t('settings.systemInfo') }}
          </h2>

          <div class="settings-grid">
            <div class="setting-row compact">
              <span class="setting-label">{{ t('settings.platform') }}</span>
              <div class="setting-value mono">{{ platform }}</div>
            </div>
            <div class="setting-row compact">
              <span class="setting-label">{{ t('settings.arch') }}</span>
              <div class="setting-value mono">{{ arch }}</div>
            </div>
          </div>
        </section>

        <!-- About -->
        <section v-else class="detail-panel">
          <h2 class="detail-title">
            <span class="material-symbols-outlined">apartment</span>
            {{ t('settings.about') }}
          </h2>

          <div class="about-content">
            <p class="about-text">
              {{ t('settings.aboutText') }}
            </p>

            <div class="about-meta">
              <div class="about-row">
                <span class="about-label">{{ t('settings.developer') }}</span>
                <span class="about-value">{{ t('settings.developerName') }}</span>
              </div>
              <div class="about-row">
                <span class="about-label">{{ t('settings.license') }}</span>
                <span class="about-value mono">{{ t('settings.licenseValue') }}</span>
              </div>
              <div class="about-row">
                <span class="about-label">{{ t('settings.currentVersion') }}</span>
                <span class="about-value mono">{{ appVersion }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 28px 32px 24px;
}

.settings-header {
  flex-shrink: 0;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.settings-title {
  font-family: 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
}

.settings-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  margin-top: 4px;
}

.settings-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 3fr 7fr;
  gap: 16px;
  overflow: hidden;
}

/* Left nav */
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow-y: auto;
  min-height: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.nav-item .material-symbols-outlined {
  font-size: 20px;
  flex-shrink: 0;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-on-surface);
}

.nav-item.active {
  background: rgba(173, 199, 255, 0.12);
  border-color: rgba(173, 199, 255, 0.25);
  color: var(--color-primary);
}

.nav-item.active .material-symbols-outlined {
  color: var(--color-primary);
}

.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Right detail */
.settings-detail {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.detail-panel {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 24px 28px;
  min-height: 100%;
  box-sizing: border-box;
}

.detail-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.detail-title .material-symbols-outlined {
  color: var(--color-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(65, 71, 84, 0.3);
}

.setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-row.compact {
  padding: 10px 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  color: var(--color-on-surface);
  font-weight: 500;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.setting-value {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  text-align: right;
  max-width: 55%;
  word-break: break-all;
  flex-shrink: 0;
}

.setting-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.setting-value.highlight {
  color: var(--color-primary);
  font-weight: 600;
}

.setting-select {
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  min-width: 160px;
}

.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.setting-btn:hover { opacity: 0.9; }
.setting-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.update-result {
  margin-top: 12px;
  padding: 10px 16px;
  background: rgba(173, 199, 255, 0.1);
  border: 1px solid rgba(173, 199, 255, 0.3);
  border-radius: 4px;
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.update-result.error {
  background: rgba(255, 180, 171, 0.1);
  border-color: rgba(255, 180, 171, 0.3);
  color: var(--color-error);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 32px;
}

.settings-grid .setting-row.compact {
  border-bottom: 1px solid rgba(65, 71, 84, 0.3);
}

.settings-grid .setting-row.compact:nth-last-child(-n+2) {
  border-bottom: none;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.about-text {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  line-height: 1.7;
}

.about-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline-variant);
}

.about-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  gap: 16px;
}

.about-label {
  color: var(--color-on-surface-variant);
}

.about-value {
  color: var(--color-on-surface);
  font-weight: 500;
}

.about-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.kbd-desc {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  margin-bottom: 18px;
  line-height: 1.5;
}

.kbd-group {
  --group-accent: var(--color-primary);
  margin-bottom: 18px;
  padding: 14px 16px 16px;
  border-radius: 10px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--group-accent) 8%, transparent), transparent 48%),
    rgba(20, 22, 26, 0.55);
  border: 1px solid color-mix(in srgb, var(--group-accent) 22%, rgba(255, 255, 255, 0.08));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.kbd-group.tone-motion { --group-accent: #7eb6ff; }
.kbd-group.tone-io { --group-accent: #5eead4; }
.kbd-group.tone-step { --group-accent: #c4b5fd; }

.kbd-group:last-of-type {
  margin-bottom: 16px;
}

.kbd-group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.kbd-group-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--group-accent) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--group-accent) 35%, transparent);
  color: var(--group-accent);
  flex-shrink: 0;
}

.kbd-group-badge .material-symbols-outlined {
  font-size: 18px;
}

.kbd-group-text {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.kbd-group-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface);
}

.kbd-group-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--group-accent);
  background: color-mix(in srgb, var(--group-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--group-accent) 28%, transparent);
}

.kbd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
}

.kbd-hint {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-on-surface-variant);
  background: rgba(0, 0, 0, 0.22);
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.io-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.18);
}

.io-header,
.io-row {
  display: grid;
  grid-template-columns: minmax(110px, 1.15fr) 1fr 1fr minmax(110px, 0.95fr);
  gap: 10px;
  align-items: center;
}

.io-header {
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(0, 0, 0, 0.28);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.io-header .col-toggle { color: #7dd3fc; }
.io-header .col-pulse { color: #fbbf24; }
.io-header .col-ms { color: #a7f3d0; }

.io-row {
  padding: 8px 12px;
  transition: background 0.15s;
}

.io-row:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}

.io-row:hover {
  background: rgba(94, 234, 212, 0.06);
}

.io-row.has-default .io-index {
  background: color-mix(in srgb, #5eead4 28%, transparent);
  border-color: color-mix(in srgb, #5eead4 50%, transparent);
  color: #5eead4;
}

.io-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.io-index {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.io-name-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.io-ms {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 2px 4px 2px 2px;
  border-radius: 6px;
  background: rgba(167, 243, 208, 0.06);
  border: 1px solid rgba(167, 243, 208, 0.16);
}

.io-ms-input {
  width: 100%;
  min-width: 0;
  max-width: 88px;
  padding: 5px 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid transparent;
  border-radius: 4px;
  color: #a7f3d0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  appearance: none;
  -webkit-appearance: none;
}

.io-ms-input:focus {
  outline: none;
  border-color: rgba(167, 243, 208, 0.45);
  background: rgba(0, 0, 0, 0.35);
}

.io-ms-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: rgba(167, 243, 208, 0.7);
  flex-shrink: 0;
  padding-right: 4px;
}

.kbd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.kbd-row:hover {
  background: color-mix(in srgb, var(--group-accent) 8%, transparent);
  border-color: color-mix(in srgb, var(--group-accent) 18%, transparent);
}

.kbd-label {
  font-size: 13px;
  color: var(--color-on-surface);
  min-width: 0;
}

.kbd-key {
  padding: 6px 12px;
  min-width: 92px;
  text-align: center;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: var(--group-accent, var(--color-primary));
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
  flex-shrink: 0;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.25);
}

.kbd-key:hover {
  border-color: color-mix(in srgb, var(--group-accent, var(--color-primary)) 55%, transparent);
  background: color-mix(in srgb, var(--group-accent, var(--color-primary)) 14%, transparent);
}

.kbd-key:active {
  transform: translateY(1px);
}

.kbd-key.key-toggle {
  color: #7dd3fc;
  border-color: rgba(125, 211, 252, 0.28);
  background: rgba(125, 211, 252, 0.08);
}

.kbd-key.key-toggle:hover {
  border-color: rgba(125, 211, 252, 0.55);
  background: rgba(125, 211, 252, 0.16);
}

.kbd-key.key-pulse {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.08);
}

.kbd-key.key-pulse:hover {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.16);
}

.kbd-key.key-step {
  color: #c4b5fd;
}

.kbd-key.unbound {
  color: rgba(255, 255, 255, 0.35);
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.02);
  font-weight: 500;
}

.kbd-key.unbound.key-toggle {
  color: rgba(125, 211, 252, 0.4);
  border-color: rgba(125, 211, 252, 0.18);
}

.kbd-key.unbound.key-pulse {
  color: rgba(251, 191, 36, 0.4);
  border-color: rgba(251, 191, 36, 0.18);
}

.kbd-key.recording {
  border-style: solid !important;
  border-color: var(--color-tertiary) !important;
  color: var(--color-tertiary) !important;
  background: color-mix(in srgb, var(--color-tertiary) 16%, transparent) !important;
  animation: kbd-pulse 0.8s ease-in-out infinite;
}

@keyframes kbd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.setting-btn.secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}
</style>
