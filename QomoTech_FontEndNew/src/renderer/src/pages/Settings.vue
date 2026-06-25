<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useL10n, getLocale, setLocale, type Locale } from '../shared/l10n'
import { themes, applyTheme } from '../shared/theme'
import { useKeyboardBindings, type KeyBinding } from '../shared/motion'

const { t } = useL10n()
const { bindings, resetToDefaults, updateBinding } = useKeyboardBindings()

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

// Update status
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

// === Keyboard shortcut recording ===
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

    <div class="settings-content">

      <!-- General -->
      <section class="settings-section">
        <h2 class="section-title">
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
      <section class="settings-section">
        <h2 class="section-title">
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
      <section class="settings-section">
        <h2 class="section-title">
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

      <!-- Keyboard Shortcuts -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="material-symbols-outlined">keyboard</span>
          {{ t('kbd.title') }}
        </h2>
        <p class="kbd-desc">{{ t('kbd.desc') }}</p>

        <div class="kbd-grid">
          <div v-for="b in bindings" :key="b.id" class="kbd-row">
            <span class="kbd-label">{{ t(b.label) }}</span>
            <button
              class="kbd-key"
              :class="{ recording: recordingId === b.id }"
              @click="startRecord(b.id)"
            >
              {{ recordingId === b.id ? t('kbd.recording') : formatKey(b) }}
            </button>
          </div>
        </div>

        <button class="setting-btn secondary" @click="resetToDefaults">
          <span class="material-symbols-outlined">restart_alt</span>
          {{ t('kbd.reset') }}
        </button>
      </section>

      <!-- System Info -->
      <section class="settings-section">
        <h2 class="section-title">
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
      <section class="settings-section">
        <h2 class="section-title">
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
</template>

<style scoped>
.settings-page {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
}

.settings-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-outline-variant);
}

.settings-title {
  font-family: 'Inter', sans-serif;
  font-size: 32px;
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 900px;
}

/* Section */
.settings-section {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 24px;
}

.section-title {
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

.section-title .material-symbols-outlined {
  color: var(--color-primary);
}

/* Setting row */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  max-width: 50%;
  word-break: break-all;
}

.setting-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.setting-value.highlight {
  color: var(--color-primary);
  font-weight: 600;
}

/* Select */
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
  min-width: 140px;
}

.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Button */
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
}

.setting-btn:hover { opacity: 0.9; }
.setting-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Update result */
.update-result {
  margin-top: 12px;
  padding: 10px 16px;
  background: rgba(173, 199, 255, 0.1);
  border: 1px solid rgba(173, 199, 255, 0.3);
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.update-result.error {
  background: rgba(255, 180, 171, 0.1);
  border-color: rgba(255, 180, 171, 0.3);
  color: var(--color-error);
}

/* Grid for compact rows */
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

/* About */
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

/* Keyboard bindings */
.kbd-desc {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  margin-bottom: 16px;
}

.kbd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  margin-bottom: 16px;
}

.kbd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(65, 71, 84, 0.2);
}

.kbd-label {
  font-size: 13px;
  color: var(--color-on-surface);
}

.kbd-key {
  padding: 4px 12px;
  min-width: 100px;
  text-align: center;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.kbd-key:hover {
  border-color: var(--color-primary);
}

.kbd-key.recording {
  border-color: var(--color-tertiary);
  color: var(--color-tertiary);
  animation: kbd-pulse 0.8s ease-in-out infinite;
}

@keyframes kbd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.setting-btn.secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}
</style>
