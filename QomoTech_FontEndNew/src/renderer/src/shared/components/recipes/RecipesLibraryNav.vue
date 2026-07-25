<script setup lang="ts">
import { useL10n } from '../../l10n'

export type LibraryType = 'laser' | 'blackening' | 'machining' | 'horizontal' | 'vertical'

defineProps<{
  selectedType: LibraryType
  counts: Record<LibraryType, number>
}>()

const emit = defineEmits<{
  'select-type': [LibraryType]
}>()

const { t } = useL10n()

const TYPES: { type: LibraryType; labelKey: string }[] = [
  { type: 'laser', labelKey: 'recipes.typeLaser' },
  { type: 'blackening', labelKey: 'recipes.typeBlackening' },
  { type: 'machining', labelKey: 'recipes.typeMachining' },
  { type: 'horizontal', labelKey: 'recipes.typeHorizontal' },
  { type: 'vertical', labelKey: 'recipes.typeVertical' }
]
</script>

<template>
  <nav class="rln">
    <div class="rln-label">{{ t('recipes.modeLibrary') }}</div>
    <div class="rln-list">
      <button
        v-for="item in TYPES"
        :key="item.type"
        type="button"
        class="rln-item"
        :class="{ active: item.type === selectedType }"
        @click="emit('select-type', item.type)"
      >
        <span class="rln-text">{{ t(item.labelKey) }}</span>
        <span class="rln-count">{{ counts[item.type] ?? 0 }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rln {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-surface-container-low) 92%, transparent);
  border-right: 1px solid var(--color-outline-variant);
  padding: 12px 8px;
}
.rln-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  padding: 0 6px 8px;
  flex-shrink: 0;
}
.rln-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rln-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--color-on-surface);
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.rln-item:hover {
  background: color-mix(in srgb, var(--color-surface-variant) 50%, transparent);
}
.rln-item.active {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary);
}
.rln-text {
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rln-count {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  min-width: 1.5em;
  padding: 1px 6px;
  border-radius: 4px;
  text-align: center;
  color: var(--color-on-surface-variant);
  background: color-mix(in srgb, var(--color-outline-variant) 40%, transparent);
}
.rln-item.active .rln-count {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
}
</style>
