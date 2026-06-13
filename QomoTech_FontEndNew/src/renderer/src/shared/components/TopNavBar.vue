<script setup lang="ts">
import { ref } from 'vue'
import { useL10n } from '../l10n'
import UpdateInfo from './UpdateInfo.vue'

const { t } = useL10n()

const SEEN_KEY = 'qomotech:updateSeen'

const updateInfoRef = ref<InstanceType<typeof UpdateInfo> | null>(null)
const showUpdateBadge = ref(!localStorage.getItem(SEEN_KEY))

function openUpdates() {
  localStorage.setItem(SEEN_KEY, '1')
  showUpdateBadge.value = false
  updateInfoRef.value?.toggle()
}
</script>

<template>
  <header class="topnav">
    <div class="topnav-left">
      <span class="topnav-brand">{{ t('app.brand') }}</span>
      <div class="topnav-status">
        <span class="status-dot"></span>
        <span class="status-label">{{ t('app.statusReady') }}</span>
      </div>
    </div>
    <div class="topnav-right">
      <button class="topnav-btn">
        <span class="material-symbols-outlined">settings</span>
      </button>
      <button class="topnav-btn" :class="{ 'has-badge': showUpdateBadge }" @click="openUpdates">
        <span class="material-symbols-outlined">notifications</span>
        <span class="badge"></span>
      </button>
      <div class="topnav-user">
        <span class="material-symbols-outlined icon-primary">account_circle</span>
        <span class="user-label">{{ t('app.operator') }}</span>
      </div>
    </div>
  </header>

  <UpdateInfo ref="updateInfoRef" />
</template>

<style scoped>
.topnav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 64px;
  padding: 0 24px;
  background: var(--color-surface-container);
  border-bottom: 1px solid var(--color-outline-variant);
  z-index: 50;
  flex-shrink: 0;
}

.topnav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topnav-brand {
  font-family: 'Inter', sans-serif;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
}

.topnav-status {
  margin-left: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 16px;
  background: var(--color-surface-container-low);
  border-radius: 4px;
  border: 1px solid var(--color-outline-variant);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.status-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.topnav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topnav-btn {
  padding: 8px;
  color: var(--color-on-surface-variant);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.topnav-btn:hover {
  background: var(--color-surface-variant);
}

.has-badge .badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error);
}

.topnav-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.topnav-user:hover {
  background: var(--color-surface-variant);
}

.icon-primary {
  color: var(--color-primary);
}

.user-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
}
</style>
