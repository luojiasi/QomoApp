<script setup lang="ts">
import type { LayerItem } from '../../composables/useLayoutPanel'

defineProps<{
  layers?: LayerItem[]
}>()

const emit = defineEmits<{
  'toggle-layer': [id: string]
  'add-layer': []
  'delete-layer': [id: string]
}>()
</script>

<template>
  <div class="layout-panel">
    <div class="panel-header">
      <span class="panel-title">图层</span>
      <button class="btn-icon" @click="emit('add-layer')" title="新建图层">+</button>
    </div>
    <div class="panel-body">
      <div v-if="!layers || layers.length === 0" class="empty-hint">暂无图层</div>
      <div
        v-for="layer in layers"
        :key="layer.id"
        class="layer-row"
        :class="{ hidden: !layer.visible }"
      >
        <button class="btn-icon btn-eye" @click="emit('toggle-layer', layer.id)">
          {{ layer.visible ? '👁' : '—' }}
        </button>
        <span class="layer-name">{{ layer.name }}</span>
        <span class="layer-count">{{ layer.count }}</span>
        <button
          v-if="(layers?.length ?? 0) > 1"
          class="btn-icon btn-del"
          @click="emit('delete-layer', layer.id)"
        >×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d4d4d8;
  font-size: 13px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.panel-title { font-weight: 500; }
.panel-body { flex: 1; overflow-y: auto; }
.empty-hint {
  padding: 24px 10px;
  text-align: center;
  color: #52525b;
  font-size: 12px;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.layer-row:hover { background: #1f1f23; }
.layer-row.hidden { opacity: 0.4; }
.layer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.layer-count { color: #71717a; font-size: 11px; }
.btn-icon {
  background: none;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 15px;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
}
.btn-icon:hover { color: #fff; background: #27272a; }
.btn-del { font-size: 16px; }
</style>
