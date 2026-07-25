<script setup lang="ts">
import { useL10n } from '../../l10n'

defineProps<{
  mode: 'flow' | 'library'
  dirty: boolean
  savingHint: string
}>()

const emit = defineEmits<{
  'update:mode': ['flow' | 'library']
  save: []
}>()

const { t } = useL10n()
</script>

<template>
  <header class="rtb">
    <div class="rtb-left">
      <h1 class="rtb-title">{{ t('nav.recipes') }}</h1>
      <div class="rtb-seg" role="group">
        <button
          type="button"
          class="rtb-pill"
          :class="{ active: mode === 'flow' }"
          @click="emit('update:mode', 'flow')"
        >
          {{ t('recipes.modeFlow') }}
        </button>
        <button
          type="button"
          class="rtb-pill"
          :class="{ active: mode === 'library' }"
          @click="emit('update:mode', 'library')"
        >
          {{ t('recipes.modeLibrary') }}
        </button>
      </div>
    </div>
    <div class="rtb-right">
      <div class="rtb-status">
        <span v-if="dirty" class="rtb-dirty">{{ t('recipes.unsaved') }}</span>
        <span v-else class="rtb-saved">{{ t('recipes.saved') }}</span>
        <span v-if="savingHint" class="rtb-hint">{{ savingHint }}</span>
      </div>
      <button
        type="button"
        class="rtb-save"
        :class="{ pulse: dirty }"
        :disabled="!dirty"
        @click="emit('save')"
      >
        <span class="material-symbols-outlined">save</span>
        {{ dirty ? t('recipes.saveChanges') : t('recipes.save') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.rtb {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--color-surface-container) 90%, transparent);
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}
.rtb-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.rtb-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--color-on-surface);
  letter-spacing: 0.01em;
}
.rtb-seg {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
}
.rtb-pill {
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  transition: background 0.12s ease, color 0.12s ease;
}
.rtb-pill:hover:not(.active) {
  color: var(--color-on-surface);
}
.rtb-pill.active {
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
}
.rtb-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.rtb-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.rtb-dirty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-tertiary);
}
.rtb-saved {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
}
.rtb-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-primary);
}
.rtb-save {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-on-surface-variant);
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.rtb-save .material-symbols-outlined {
  font-size: 16px;
}
.rtb-save:hover:not(:disabled) {
  background: var(--color-surface-variant);
}
.rtb-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.rtb-save.pulse {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  animation: rtb-pulse 1.5s ease-in-out infinite;
}
@keyframes rtb-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
  50% { box-shadow: 0 0 8px 2px color-mix(in srgb, var(--color-primary) 25%, transparent); }
}
</style>
