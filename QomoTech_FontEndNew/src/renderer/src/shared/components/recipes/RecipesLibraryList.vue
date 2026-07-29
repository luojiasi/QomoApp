<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../../l10n'

type LibraryType = 'laser' | 'blackening' | 'machining' | 'horizontal' | 'vertical'

const props = defineProps<{
  type: LibraryType
  items: { id: string; name?: string }[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [string]
  new: []
  delete: []
  rename: [string]
}>()

const { t } = useL10n()

const TYPE_LABEL_KEYS: Record<LibraryType, string> = {
  laser: 'recipes.typeLaser',
  blackening: 'recipes.typeBlackening',
  machining: 'recipes.typeMachining',
  horizontal: 'recipes.typeHorizontal',
  vertical: 'recipes.typeVertical'
}

const typeLabel = computed(() => t(TYPE_LABEL_KEYS[props.type]))
const hasSelection = computed(() => Boolean(props.selectedId))

function displayName(item: { id: string; name?: string }): string {
  return (item.name && item.name.trim()) || item.id
}
</script>

<template>
  <aside class="rll">
    <div class="rll-head">
      <div class="rll-title">{{ typeLabel }}</div>
      <div class="rll-actions">
        <button type="button" class="rll-act" @click="emit('new')">
          <span class="material-symbols-outlined">add</span>
          {{ t('recipes.new') }}
        </button>
        <button
          type="button"
          class="rll-act danger"
          :disabled="!hasSelection"
          @click="emit('delete')"
        >
          <span class="material-symbols-outlined">delete</span>
          {{ t('recipes.delete') }}
        </button>
      </div>
    </div>

    <div class="rll-list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="rll-item"
        :class="{ active: item.id === selectedId }"
        @click="emit('select', item.id)"
        @dblclick="emit('rename', item.id)"
        @contextmenu.prevent="emit('rename', item.id)"
      >
        <span class="rll-name">{{ displayName(item) }}</span>
        <span v-if="item.name && item.name.trim()" class="rll-id">{{ item.id }}</span>
      </button>

      <div v-if="items.length === 0" class="rll-empty">
        <span class="material-symbols-outlined rll-empty-icon">inventory_2</span>
        <span class="rll-empty-text">{{ t('recipes.emptyMain') }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.rll {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-surface-container) 88%, transparent);
  border-right: 1px solid var(--color-outline-variant);
}
.rll-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  flex-shrink: 0;
}
.rll-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
.rll-actions {
  display: flex;
  gap: 4px;
}
.rll-act {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 5px 3px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 6px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  transition: background 0.15s ease, color 0.15s ease;
}
.rll-act .material-symbols-outlined {
  font-size: 15px;
}
.rll-act:hover:not(:disabled) {
  background: var(--color-surface-variant);
}
.rll-act:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.rll-act.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-error) 15%, transparent);
  color: var(--color-error);
}
.rll-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 8px;
}
.rll-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 10px;
  margin-bottom: 2px;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 0 8px 8px 0;
  background: none;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.rll-item:hover {
  background: var(--color-surface-variant);
}
.rll-item.active {
  background: color-mix(in srgb, var(--color-surface-variant) 55%, transparent);
  border-left-color: var(--color-primary);
}
.rll-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rll-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
}
.rll-empty {
  padding: 24px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-on-surface-variant);
}
.rll-empty-icon {
  font-size: 32px;
  opacity: 0.4;
}
.rll-empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  opacity: 0.55;
}
</style>
