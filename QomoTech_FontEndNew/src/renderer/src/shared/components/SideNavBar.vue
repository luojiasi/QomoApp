<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useL10n } from '../l10n'

const { t } = useL10n()
const router = useRouter()
const route = useRoute()

const appVersion = ref('')

onMounted(async () => {
  try {
    const info = await window.api.system.getInfo()
    appVersion.value = info.appVersion
  } catch { /* ignore */ }
})

interface NavItem {
  path: string
  icon: string
  labelKey: string
}

const mainNavItems: NavItem[] = [
  { path: '/monitor', icon: 'videocam', labelKey: 'nav.monitor' },
  { path: '/control', icon: 'settings_input_component', labelKey: 'nav.control' },
  { path: '/controller-settings', icon: 'precision_manufacturing', labelKey: 'nav.controllerSettings' },
  { path: '/recipes', icon: 'description', labelKey: 'nav.recipes' },
  { path: '/serial', icon: 'terminal', labelKey: 'nav.serial' }
]

const bottomNavItems: NavItem[] = [
  { path: '/settings', icon: 'settings', labelKey: 'nav.settings' },
  { path: '/diagnostics', icon: 'monitor_heart', labelKey: 'nav.diagnostics' }
]

function isActive(path: string): boolean {
  return route.path === path
}

function navigate(path: string): void {
  router.push(path)
}
</script>

<template>
  <nav class="sidenav">
    <div class="sidenav-header">
      <h2 class="sidenav-title">{{ t('app.brand') }}</h2>
      <p class="sidenav-subtitle">v{{ appVersion }}</p>
    </div>

    <div class="sidenav-main">
      <a
        v-for="item in mainNavItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        @click="navigate(item.path)"
      >
        <span
          class="material-symbols-outlined"
          :style="isActive(item.path) ? { fontVariationSettings: `'FILL' 1` } : {}"
        >{{ item.icon }}</span>
        <span class="nav-label">{{ t(item.labelKey) }}</span>
      </a>
    </div>

    <div class="sidenav-bottom">
      <a
        v-for="item in bottomNavItems"
        :key="item.path"
        class="nav-item"
        @click="navigate(item.path)"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span class="nav-label">{{ t(item.labelKey) }}</span>
      </a>

      <button class="emergency-btn">
        {{ t('nav.emergencyStop') }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  width: 280px;
  background: var(--color-surface-container-high);
  border-right: 1px solid var(--color-outline-variant);
  padding: 24px 0;
  z-index: 40;
  flex-shrink: 0;
}

.sidenav-header {
  padding: 0 16px;
  margin-bottom: 32px;
}

.sidenav-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.sidenav-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.sidenav-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  gap: 4px;
}

.sidenav-bottom {
  padding: 0 8px;
  margin-top: auto;
  border-top: 1px solid var(--color-outline-variant);
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.nav-item:hover {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.nav-item.active {
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}

.nav-item .material-symbols-outlined {
  font-size: 20px;
}

.nav-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.emergency-btn {
  margin-top: 16px;
  width: calc(100% - 16px);
  margin-left: 8px;
  padding: 16px 8px;
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.emergency-btn:hover {
  opacity: 0.9;
}

.emergency-btn:active {
  transform: scale(0.95);
}
</style>
