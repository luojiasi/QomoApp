<script setup lang="ts">
import { ref } from 'vue'
import type { LayerItem } from '../../composables/useLayoutPanel'
import { useLayoutPanel } from '../../composables/useLayoutPanel'

defineProps<{
  layers?: LayerItem[]
}>()

const emit = defineEmits<{
  'toggle-layer': [id: string]
  'add-layer': []
  'delete-layer': [id: string]
}>()

const { getLayerEntities, moveEntity } = useLayoutPanel()

/** 当前展开的图层 id → 是否展开 */
const expandedLayers = ref<Record<string, boolean>>({})

function toggleExpand(layerId: string) {
  expandedLayers.value = {
    ...expandedLayers.value,
    [layerId]: !expandedLayers.value[layerId],
  }
}
</script>

<template>
  <div class="layout-panel">
    <div class="panel-header">
      <span class="panel-title">图层</span>
      <button class="btn-icon" @click="emit('add-layer')" title="新建图层">+</button>
    </div>
    <div class="panel-body">
      <div v-if="!layers || layers.length === 0" class="empty-hint">暂无图层</div>

      <template v-for="layer in layers" :key="layer.id">
        <!-- 图层行 -->
        <div class="layer-row" :class="{ hidden: !layer.visible }">
          <button
            class="btn-icon btn-expand"
            :class="{ expanded: expandedLayers[layer.id] }"
            @click="toggleExpand(layer.id)"
          >
            {{ expandedLayers[layer.id] ? '▼' : '▶' }}
          </button>
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

        <!-- 实体列表（只读） -->
        <div v-if="expandedLayers[layer.id]" class="entity-list">
          <div v-if="layer.count === 0" class="entity-empty">暂无实体</div>
          <div
            v-for="ent in getLayerEntities(layer.id)"
            :key="ent.id"
            class="entity-row"
          >
            <span class="entity-kind">{{ ent.kindLabel }}</span>
            <span class="entity-geo">{{ ent.geometry }}</span>
            <select
              class="entity-layer-select"
              :value="ent.layerId"
              @change="moveEntity(ent.id, ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="l in layers"
                :key="l.id"
                :value="l.id"
              >{{ l.name }}</option>
            </select>
          </div>
        </div>
      </template>
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

/* ── 图层行 ── */
.layer-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  transition: background 0.15s;
}
.layer-row:hover { background: #1f1f23; }
.layer-row.hidden { opacity: 0.4; }
.layer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.layer-count { color: #71717a; font-size: 11px; }

/* ── 展开箭头 ── */
.btn-expand {
  font-size: 9px;
  width: 16px;
  padding: 2px 0;
  color: #52525b;
  transition: transform 0.15s, color 0.15s;
}
.btn-expand:hover { color: #a1a1aa; }

/* ── 实体列表 ── */
.entity-list {
  margin-left: 22px;
  border-left: 1px solid #1f1f23;
  padding: 2px 0 4px 10px;
}
.entity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
  color: #71717a;
}
.entity-empty {
  padding: 4px 0;
  font-size: 11px;
  color: #3f3f46;
  font-style: italic;
}
.entity-kind {
  flex-shrink: 0;
  display: inline-block;
  min-width: 32px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #18181b;
  color: #a1a1aa;
  font-size: 11px;
  text-align: center;
}
.entity-geo {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entity-layer-select {
  flex-shrink: 0;
  max-width: 80px;
  background: #18181b;
  color: #a1a1aa;
  border: 1px solid #27272a;
  border-radius: 3px;
  font-size: 11px;
  padding: 1px 2px;
  cursor: pointer;
  outline: none;
}
.entity-layer-select:focus {
  border-color: #3b82f6;
}

/* ── 通用按钮 ── */
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
