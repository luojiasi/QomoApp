<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TopNavBar from './shared/components/TopNavBar.vue'
import SideNavBar from './shared/components/SideNavBar.vue'
import UpdateModal from './shared/components/UpdateModal.vue'
import { themes, applyTheme } from './shared/theme'
import { startKeyboardJog, stopKeyboardJog, useKeyboardJogState, closeStepDialog } from './shared/motion'

const { showStepDialog, customStepInput, applyCustomStep } = useKeyboardJogState()

onMounted(() => {
  const saved = localStorage.getItem('qomotech:theme') ?? themes[0].id
  applyTheme(saved)
  startKeyboardJog()
})

onUnmounted(() => {
  stopKeyboardJog()
})
</script>

<template>
  <div class="app-shell">
    <TopNavBar />
    <div class="app-body">
      <SideNavBar />
      <main class="app-main">
        <router-view />
      </main>
    </div>

    <UpdateModal />

    <!-- Global step dialog — visible from any page -->
    <div v-if="showStepDialog" class="step-dialog-overlay" @click.self="closeStepDialog()">
      <div class="step-dialog">
        <span class="step-dialog-title">自定义步长</span>
        <input v-model="customStepInput" type="number" min="0.001" step="0.001"
          class="step-dialog-input" placeholder="输入数值..."
          @keydown.enter="applyCustomStep()" @keydown.stop />
        <div class="step-dialog-btns">
          <button class="btn-sm btn-primary" @click="applyCustomStep()">OK</button>
          <button class="btn-sm btn-secondary" @click="closeStepDialog()">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --color-background: #10131b;
  --color-surface: #10131b;
  --color-surface-dim: #10131b;
  --color-surface-bright: #363942;
  --color-surface-container-lowest: #0b0e16;
  --color-surface-container-low: #181c23;
  --color-surface-container: #1c2027;
  --color-surface-container-high: #272a32;
  --color-surface-container-highest: #31353d;
  --color-on-surface: #e0e2ed;
  --color-on-surface-variant: #c1c6d7;
  --color-outline: #8b90a0;
  --color-outline-variant: #414754;
  --color-primary: #adc7ff;
  --color-on-primary: #002e68;
  --color-primary-container: #4a8eff;
  --color-on-primary-container: #00285b;
  --color-secondary: #c4c6cb;
  --color-on-secondary: #2e3135;
  --color-secondary-container: #494c50;
  --color-on-secondary-container: #babcc1;
  --color-tertiary: #ffb695;
  --color-on-tertiary: #571e00;
  --color-tertiary-container: #ef6719;
  --color-on-tertiary-container: #4c1a00;
  --color-error: #ffb4ab;
  --color-on-error: #690005;
  --color-error-container: #93000a;
  --color-on-error-container: #ffdad6;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-on-surface);
  background: var(--color-background);
}

/* Material Symbols（本地字体，见 main.ts） */
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined', sans-serif;
  font-size: 20px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: 3px;
}
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: var(--color-surface-container-low);
}

::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: 3px;
}

/* Step dialog (global, unscoped) */
.step-dialog-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.step-dialog {
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 8px;
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 12px;
  min-width: 280px;
}
.step-dialog-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px; font-weight: 600;
  color: var(--color-on-surface);
}
.step-dialog-input {
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  outline: none;
}
.step-dialog-input:focus { border-color: var(--color-primary); }
.step-dialog-btns {
  display: flex; gap: 8px; justify-content: flex-end;
}
.btn-sm {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.btn-secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}
</style>
