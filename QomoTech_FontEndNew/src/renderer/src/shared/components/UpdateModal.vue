<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useL10n } from '../l10n'

const { t } = useL10n()

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

const visible = ref(false)
const updateStatus = ref<UpdateStatus>('idle')
const updateMessage = ref('')
const downloadProgress = ref(0)
const newVersion = ref('')
const currentVersion = ref('')

const unsubs: (() => void)[] = []

function show() {
  visible.value = true
}

function dismiss() {
  visible.value = false
}

onMounted(() => {
  unsubs.push(
    window.api.update.onCheckingForUpdate(() => {
      updateStatus.value = 'checking'
      visible.value = true
    }),
    window.api.update.onUpdateAvailable((info: any) => {
      updateStatus.value = 'available'
      newVersion.value = info?.version ?? ''
      visible.value = true
    }),
    window.api.update.onUpdateNotAvailable(() => {
      if (updateStatus.value === 'checking' && visible.value) {
        updateStatus.value = 'idle'
        visible.value = false
      }
    }),
    window.api.update.onDownloadProgress((progress: any) => {
      downloadProgress.value = progress?.percent ?? 0
    }),
    window.api.update.onUpdateDownloaded(() => {
      updateStatus.value = 'downloaded'
    }),
    window.api.update.onError((error: string) => {
      updateStatus.value = 'error'
      updateMessage.value = error
      visible.value = true
    })
  )

  // Auto-check on mount (only checks, does NOT download)
  loadCurrentVersion()
  checkUpdate()
})

onUnmounted(() => {
  unsubs.forEach((fn) => fn())
})

async function loadCurrentVersion() {
  try {
    const info = await window.api.system.getInfo()
    currentVersion.value = info.appVersion
  } catch {
    currentVersion.value = '0.0.0'
  }
}

async function checkUpdate() {
  updateStatus.value = 'checking'
  visible.value = true
  try {
    const result = await window.api.update.check()
    if (result.success) {
      if (result.updateInfo) {
        const info = result.updateInfo as any
        updateStatus.value = 'available'
        newVersion.value = info.version ?? ''
      } else {
        // updateInfo is null means no update available
        updateStatus.value = 'idle'
        visible.value = false
      }
    } else {
      updateStatus.value = 'error'
      updateMessage.value = result.error ?? t('update.errorOccurred')
    }
  } catch {
    updateStatus.value = 'error'
    updateMessage.value = t('update.errorOccurred')
  }
}

async function downloadUpdate() {
  updateStatus.value = 'downloading'
  const result = await window.api.update.download()
  if (!result.success) {
    updateStatus.value = 'error'
    updateMessage.value = result.error ?? t('update.errorOccurred')
  }
}

function installUpdate() {
  window.api.update.install()
}

const statusIcon = computed(() => {
  const map: Record<string, string> = {
    checking: 'sync',
    available: 'system_update',
    downloading: 'cloud_download',
    downloaded: 'check_circle',
    error: 'error',
    idle: 'info'
  }
  return map[updateStatus.value] ?? 'info'
})

const statusTitle = computed(() => {
  const map: Record<string, string> = {
    checking: t('update.checking'),
    available: t('update.available'),
    downloading: t('update.downloading'),
    downloaded: t('update.downloaded'),
    error: t('update.error'),
    idle: ''
  }
  return map[updateStatus.value] ?? ''
})

defineExpose({ show, dismiss, checkUpdate })
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div class="update-overlay" v-if="visible" @click.self="dismiss">
        <!-- Animated gaussian blur rings -->
        <div class="bg-animation">
          <div class="bg-ring ring-1"></div>
          <div class="bg-ring ring-2"></div>
          <div class="bg-ring ring-3"></div>
          <div class="bg-particles">
            <div class="particle" v-for="i in 20" :key="i" :style="{
              left: `${Math.sin(i * 137.5) * 40 + 50}%`,
              top: `${Math.cos(i * 137.5) * 40 + 50}%`,
              animationDelay: `${i * 0.3}s`,
              opacity: 0.03 + (i % 5) * 0.01
            }"></div>
          </div>
        </div>

        <div class="update-modal">
          <div class="update-modal-header">
            <span class="material-symbols-outlined update-modal-icon" :class="{ spin: updateStatus === 'checking' }">
              {{ statusIcon }}
            </span>
            <h2 class="update-modal-title">{{ statusTitle }}</h2>
          </div>

          <div class="update-modal-body">
            <template v-if="updateStatus === 'checking'">
              <div class="update-spinner"></div>
              <p class="update-modal-text">{{ t('update.checkingDesc') }}</p>
            </template>

            <template v-else-if="updateStatus === 'available'">
              <div class="update-info-row">
                <span class="update-info-label">{{ t('update.currentVersion') }}</span>
                <span class="update-info-value">{{ currentVersion }}</span>
              </div>
              <div class="update-info-row">
                <span class="update-info-label">{{ t('update.latestVersionLabel') }}</span>
                <span class="update-info-value update-highlight">{{ newVersion }}</span>
              </div>
              <p class="update-modal-text">{{ t('update.availableDesc') }}</p>
            </template>

            <template v-else-if="updateStatus === 'downloading'">
              <div class="update-progress-ring">
                <svg viewBox="0 0 100 100">
                  <circle class="progress-bg" cx="50" cy="50" r="42" />
                  <circle
                    class="progress-fill"
                    cx="50" cy="50" r="42"
                    :style="{ strokeDashoffset: 264 - (264 * downloadProgress) / 100 }"
                  />
                </svg>
                <span class="progress-text">{{ Math.round(downloadProgress) }}%</span>
              </div>
              <p class="update-modal-text">{{ t('update.downloadingDesc') }}</p>
              <div class="update-progress-bar">
                <div class="update-progress-fill" :style="{ width: downloadProgress + '%' }"></div>
              </div>
            </template>

            <template v-else-if="updateStatus === 'downloaded'">
              <span class="material-symbols-outlined update-done-icon">check_circle</span>
              <p class="update-modal-text">{{ t('update.downloadedDesc') }}</p>
            </template>

            <template v-else-if="updateStatus === 'error'">
              <span class="material-symbols-outlined update-error-icon">error</span>
              <p class="update-modal-text error-text">{{ updateMessage }}</p>
            </template>
          </div>

          <div class="update-modal-footer">
            <button
              v-if="updateStatus === 'available'"
              class="update-btn primary pulse-btn"
              @click="downloadUpdate"
            >
              <span class="material-symbols-outlined">download</span>
              {{ t('update.download') }}
            </button>
            <button
              v-if="updateStatus === 'downloaded'"
              class="update-btn primary pulse-btn"
              @click="installUpdate"
            >
              <span class="material-symbols-outlined">restart_alt</span>
              {{ t('update.restart') }}
            </button>
            <button
              v-if="updateStatus === 'downloaded'"
              class="update-btn secondary"
              @click="dismiss"
            >
              {{ t('update.updateLater') }}
            </button>
            <button
              v-if="updateStatus === 'error'"
              class="update-btn secondary"
              @click="dismiss"
            >
              {{ t('update.close') }}
            </button>
            <button
              v-if="updateStatus === 'error'"
              class="update-btn primary"
              @click="checkUpdate"
            >
              {{ t('update.retry') }}
            </button>
            <button
              v-if="updateStatus === 'available'"
              class="update-btn secondary"
              @click="dismiss"
            >
              {{ t('update.later') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Dynamic gaussian blur background */
.bg-animation {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(24px) saturate(0.3);
  background: rgba(8, 10, 18, 0.75);
}

.bg-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(173, 199, 255, 0.08);
  pointer-events: none;
}

.ring-1 {
  width: 600px;
  height: 600px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ring-breath 4s ease-in-out infinite;
}

.ring-2 {
  width: 900px;
  height: 900px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ring-breath 6s ease-in-out infinite;
  animation-delay: -2s;
}

.ring-3 {
  width: 1200px;
  height: 1200px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: ring-breath 8s ease-in-out infinite;
  animation-delay: -4s;
}

@keyframes ring-breath {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.08); }
}

.bg-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: float-up 6s linear infinite;
}

@keyframes float-up {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
}

/* Transitions */
.overlay-fade-enter-active {
  transition: opacity 0.35s ease;
}
.overlay-fade-enter-active .update-modal {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-leave-active .update-modal {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.overlay-fade-enter-from {
  opacity: 0;
}
.overlay-fade-enter-from .update-modal {
  opacity: 0;
  transform: translateY(20px) scale(0.97);
}
.overlay-fade-leave-to {
  opacity: 0;
}
.overlay-fade-leave-to .update-modal {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.update-modal {
  position: relative;
  width: 440px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), 0 0 80px rgba(173, 199, 255, 0.08);
  overflow: hidden;
}

.update-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  background: var(--color-surface-container);
  border-bottom: 1px solid var(--color-outline-variant);
}

.update-modal-icon {
  font-size: 28px;
  color: var(--color-primary);
}

.update-modal-icon.spin {
  animation: iconSpin 0.8s linear infinite;
}

@keyframes iconSpin {
  to { transform: rotate(360deg); }
}

.update-modal-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.update-modal-body {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.update-modal-text {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  text-align: center;
  line-height: 1.6;
}

.error-text { color: var(--color-error); }

.update-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.update-info-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: var(--color-surface-container);
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
}

.update-info-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.update-info-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  font-weight: 600;
}

.update-highlight { color: var(--color-primary); }

.update-progress-ring {
  position: relative;
  width: 100px;
  height: 100px;
}

.update-progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: var(--color-surface-container-lowest);
  stroke-width: 6;
}

.progress-fill {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 264;
  stroke-dashoffset: 264;
  transition: stroke-dashoffset 0.4s ease;
}

.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.update-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--color-surface-container-lowest);
  border-radius: 3px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.update-done-icon {
  font-size: 48px;
  color: #22c55e;
  font-variation-settings: 'FILL' 1;
}

.update-error-icon {
  font-size: 48px;
  color: var(--color-error);
}

.update-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: var(--color-surface-container);
  border-top: 1px solid var(--color-outline-variant);
}

.update-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s, transform 0.1s;
  font-family: 'Inter', sans-serif;
}

.update-btn:hover { opacity: 0.9; }
.update-btn:active { transform: scale(0.97); }

.update-btn.primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.pulse-btn {
  animation: btnPulse 2s ease-in-out infinite;
}

@keyframes btnPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(173, 199, 255, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(173, 199, 255, 0); }
}

.update-btn.secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
}

.update-btn.secondary:hover {
  background: var(--color-outline-variant);
}
</style>
