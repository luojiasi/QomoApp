<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../../l10n'

const props = defineProps<{
  recipes: { id: string; name: string; status?: string }[]
  selectedId: string
  search: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:search': [string]
  select: [string]
  new: []
  clone: []
  delete: []
}>()

const { t } = useL10n()

const filtered = computed(() => {
  const q = props.search.trim().toLowerCase()
  if (!q) return props.recipes
  return props.recipes.filter(
    (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
  )
})

const hasSelection = computed(() => Boolean(props.selectedId))

function statusLabel(status: string): string {
  if (status === 'active') return t('recipes.statusActive')
  if (status === 'draft') return t('recipes.statusDraft')
  return status
}
</script>

<template>
  <aside class="rml">
    <div class="rml-head">
      <div class="rml-search">
        <span class="material-symbols-outlined rml-search-icon">search</span>
        <input
          class="rml-search-input"
          type="text"
          :value="search"
          :placeholder="t('recipes.searchPlaceholder')"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="rml-actions">
        <button type="button" class="rml-act" @click="emit('new')">
          <span class="material-symbols-outlined">add</span>
          {{ t('recipes.new') }}
        </button>
        <button type="button" class="rml-act" :disabled="!hasSelection" @click="emit('clone')">
          <span class="material-symbols-outlined">content_copy</span>
          {{ t('recipes.clone') }}
        </button>
        <button
          type="button"
          class="rml-act danger"
          :disabled="!hasSelection"
          @click="emit('delete')"
        >
          <span class="material-symbols-outlined">delete</span>
          {{ t('recipes.delete') }}
        </button>
      </div>
    </div>

    <div class="rml-list">
      <button
        v-for="r in filtered"
        :key="r.id"
        type="button"
        class="rml-item"
        :class="{ active: r.id === selectedId }"
        @click="emit('select', r.id)"
      >
        <div class="rml-item-top">
          <span class="rml-name">{{ r.name }}</span>
          <span v-if="r.status" class="rml-badge" :class="r.status">{{ statusLabel(r.status) }}</span>
        </div>
        <div class="rml-id">{{ r.id }}</div>
      </button>

      <div v-if="!loading && recipes.length === 0" class="rml-empty">
        <span class="material-symbols-outlined rml-empty-icon">science</span>
        <span class="rml-empty-text">{{ t('recipes.emptyMain') }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.rml {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-surface-container) 88%, transparent);
  border-right: 1px solid var(--color-outline-variant);
}
.rml-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  flex-shrink: 0;
}
.rml-search {
  position: relative;
}
.rml-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-outline);
  pointer-events: none;
}
.rml-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 8px 7px 32px;
  background: color-mix(in srgb, var(--color-surface-container-highest) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface);
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.rml-search-input:focus {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-surface-container-highest) 80%, transparent);
}
.rml-actions {
  display: flex;
  gap: 4px;
}
.rml-act {
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
.rml-act .material-symbols-outlined {
  font-size: 15px;
}
.rml-act:hover:not(:disabled) {
  background: var(--color-surface-variant);
}
.rml-act:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.rml-act.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-error) 15%, transparent);
  color: var(--color-error);
}
.rml-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 8px;
}
.rml-item {
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
.rml-item:hover {
  background: var(--color-surface-variant);
}
.rml-item.active {
  background: color-mix(in srgb, var(--color-surface-variant) 55%, transparent);
  border-left-color: var(--color-primary);
}
.rml-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.rml-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rml-badge {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
  background: color-mix(in srgb, var(--color-outline-variant) 40%, transparent);
}
.rml-badge.active {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #22c55e;
}
.rml-badge.draft {
  background: color-mix(in srgb, var(--color-tertiary) 15%, transparent);
  color: var(--color-tertiary);
}
.rml-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
}
.rml-empty {
  padding: 24px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-on-surface-variant);
}
.rml-empty-icon {
  font-size: 32px;
  opacity: 0.4;
}
.rml-empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  opacity: 0.55;
}
</style>
