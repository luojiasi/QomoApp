<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import EntityTypeIcon from "@/modules/entitiesEditor/shares/EntityTypeIcon.vue"

const store = useEditorStore()

const selected = computed(() => store.selectedEntities)

function updateSelected(field: string, value: number) {
  for (const entity of selected.value) {
    store.updateEntity(entity.id, { [field]: value } as Partial<typeof entity>)
  }
}
</script>

<template>
  <div class="inspector">
    <div class="inspector-header">属性</div>

    <div v-if="selected.length === 0" class="empty-hint">选择实体以编辑属性</div>

    <template v-else>
      <div class="selected-count">{{ selected.length }} 个实体已选</div>

      <div v-for="entity in selected" :key="entity.id" class="entity-card">
        <div class="entity-title">
          <EntityTypeIcon :kind="entity.kind" />
          <span>{{ entity.kind }}</span>
          <span class="entity-id">{{ entity.id.slice(0, 8) }}</span>
        </div>

        <label class="field">
          <span>高度</span>
          <input
            type="number"
            :value="entity.height"
            step="0.1"
            @input="updateSelected('height', +($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span>开口尺寸</span>
          <input
            type="number"
            :value="entity.openSize"
            step="0.1"
            @input="updateSelected('openSize', +($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span>倾斜角度</span>
          <input
            type="number"
            :value="entity.tiltAngleDeg"
            step="0.5"
            @input="updateSelected('tiltAngleDeg', +($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </template>
  </div>
</template>

<style scoped>
.inspector {
  font-size: 12px;
  color: #d4d4d8;
}
.inspector-header {
  padding: 6px 8px;
  border-bottom: 1px solid #27272a;
}
.empty-hint {
  padding: 16px 8px;
  color: #52525b;
  text-align: center;
}
.selected-count {
  padding: 4px 8px;
  color: #a1a1aa;
}
.entity-card {
  margin: 4px;
  padding: 6px 8px;
  background: #1f1f23;
  border-radius: 4px;
}
.entity-title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.entity-id {
  color: #52525b;
  font-size: 10px;
  margin-left: auto;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}
.field input {
  width: 70px;
  padding: 1px 4px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 3px;
  color: #d4d4d8;
  text-align: right;
}
</style>
