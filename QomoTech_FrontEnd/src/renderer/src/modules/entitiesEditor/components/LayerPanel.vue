<script setup lang="ts">
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"

const store = useEditorStore()

function toggleVisibility(layerId: string) {
  const layer = store.layers.find((l) => l.id === layerId)
  if (layer) store.updateLayer(layerId, { visible: !layer.visible })
}

function addLayer() {
  store.createLayer(`Layer ${store.layers.length + 1}`)
}

function removeLayer(layerId: string) {
  store.deleteLayer(layerId)
}
</script>

<template>
  <div class="layer-panel">
    <div class="panel-header">
      <span>图层</span>
      <button class="btn-add" @click="addLayer">+</button>
    </div>
    <div class="layer-list">
      <div
        v-for="layer in store.layers"
        :key="layer.id"
        class="layer-row"
        :class="{ hidden: !layer.visible }"
      >
        <button class="btn-eye" @click="toggleVisibility(layer.id)">
          {{ layer.visible ? '👁' : '—' }}
        </button>
        <span class="layer-name">{{ layer.name }}</span>
        <span class="layer-count">{{ layer.entityCount }}</span>
        <button
          v-if="store.layers.length > 1"
          class="btn-del"
          @click="removeLayer(layer.id)"
        >×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  font-size: 12px;
  color: #d4d4d8;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid #27272a;
}
.layer-list { display: flex; flex-direction: column; }
.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
}
.layer-row:hover { background: #27272a; }
.layer-row.hidden { opacity: 0.45; }
.layer-name { flex: 1; }
.layer-count { color: #71717a; font-size: 10px; }
.btn-add, .btn-del, .btn-eye {
  background: none;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
}
.btn-add:hover, .btn-del:hover { color: #fff; }
</style>
