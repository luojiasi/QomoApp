<script setup lang="ts">
import { useInspectorPanel, type InspectedEntity } from '../../composables/useInspectorPanel'

defineProps<{
  entity?: InspectedEntity | null
}>()

const emit = defineEmits<{
  'update': [field: string, value: number]
}>()

const { activeSection } = useInspectorPanel()
</script>

<template>
  <div class="inspector-panel">
    <div class="panel-header">属性</div>
    <div class="panel-body">
      <div v-if="!entity" class="empty-hint">选择实体以编辑属性</div>

      <template v-else>
        <div class="entity-kind">{{ entity.kind }} <span class="entity-id">{{ entity.id.slice(0, 8) }}</span></div>

        <div class="section-tabs">
          <button
            :class="{ active: activeSection === 'params' }"
            @click="activeSection = 'params'"
          >参数</button>
          <button
            :class="{ active: activeSection === 'transform' }"
            @click="activeSection = 'transform'"
          >变换</button>
        </div>

        <div v-if="activeSection === 'params'" class="fields">
          <label class="field">
            <span>高度</span>
            <input type="number" :value="entity.height" step="0.1"
              @input="emit('update', 'height', +($event.target as HTMLInputElement).value)" />
          </label>
          <label class="field">
            <span>开口尺寸</span>
            <input type="number" :value="entity.openSize" step="0.1"
              @input="emit('update', 'openSize', +($event.target as HTMLInputElement).value)" />
          </label>
          <label class="field">
            <span>倾斜角度</span>
            <input type="number" :value="entity.tiltAngleDeg" step="0.5"
              @input="emit('update', 'tiltAngleDeg', +($event.target as HTMLInputElement).value)" />
          </label>
        </div>

        <div v-if="activeSection === 'transform'" class="fields">
          <div class="empty-hint">变换参数（待开发）</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.inspector-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d4d4d8;
  font-size: 13px;
}
.panel-header {
  padding: 8px 10px;
  border-bottom: 1px solid #27272a;
  font-weight: 500;
  flex-shrink: 0;
}
.panel-body { flex: 1; overflow-y: auto; }
.empty-hint {
  padding: 24px 10px;
  text-align: center;
  color: #52525b;
  font-size: 12px;
}
.entity-kind {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  font-size: 14px;
}
.entity-id { color: #52525b; font-size: 11px; font-weight: 400; }
.section-tabs {
  display: flex;
  border-bottom: 1px solid #27272a;
}
.section-tabs button {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.section-tabs button.active {
  color: #e4e4e7;
  border-bottom-color: #3b82f6;
}
.fields { padding: 8px 10px; }
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.field span { font-size: 12px; color: #a1a1aa; }
.field input {
  width: 72px;
  padding: 3px 6px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: right;
}
.field input:focus { outline: none; border-color: #3b82f6; }
</style>
