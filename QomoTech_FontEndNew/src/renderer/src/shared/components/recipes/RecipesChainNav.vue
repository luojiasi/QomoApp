<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../../l10n'
import type { RecipeChainNode } from '../../recipe'

const props = defineProps<{
  nodes: RecipeChainNode[]
  activeIndex: number
}>()

const emit = defineEmits<{
  'select-index': [number]
}>()

const { t } = useL10n()

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'] as const

const prefixes = computed(() => {
  let shallow = 0
  return props.nodes.map((node) => {
    if (node.depth >= 2) return '·'
    const mark = CIRCLED[shallow] ?? `${shallow + 1}.`
    shallow += 1
    return mark
  })
})
</script>

<template>
  <nav class="rcn">
    <div class="rcn-label">{{ t('recipes.chainTitle') }}</div>
    <div class="rcn-list">
      <button
        v-for="(node, index) in nodes"
        :key="`${node.kind}-${node.id || index}`"
        type="button"
        class="rcn-item"
        :class="{ active: index === activeIndex }"
        :style="{ paddingLeft: `${10 + node.depth * 12}px` }"
        @click="emit('select-index', index)"
      >
        <span class="rcn-prefix">{{ prefixes[index] }}</span>
        <span v-if="node.missing" class="rcn-text missing">{{ t('recipes.pendingSelect') }}</span>
        <span v-else class="rcn-text">{{ node.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rcn {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-surface-container-low) 92%, transparent);
  border-right: 1px solid var(--color-outline-variant);
  padding: 12px 8px;
}
.rcn-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  padding: 0 6px 8px;
  flex-shrink: 0;
}
.rcn-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rcn-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--color-on-surface);
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.rcn-item:hover {
  background: color-mix(in srgb, var(--color-surface-variant) 50%, transparent);
}
.rcn-item.active {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-primary);
}
.rcn-prefix {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  width: 1.2em;
  text-align: center;
}
.rcn-item.active .rcn-prefix {
  color: var(--color-primary);
}
.rcn-text {
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rcn-text.missing {
  color: var(--color-tertiary);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
}
.rcn-item.active .rcn-text.missing {
  color: var(--color-tertiary);
}
</style>
