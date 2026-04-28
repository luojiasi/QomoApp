<script setup lang="ts">
import type { DataMapping, NodeType } from '../../types/selfProcessTypes'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { NODE_TYPE_META } from '../../configs/selfProcessConfigs'

const props = defineProps<{
  nodeId: string
  mappings: DataMapping[]
  nodeType: NodeType
}>()

const emit = defineEmits<{
  add: [mapping: Omit<DataMapping, 'id'>]
  remove: [mappingId: string]
}>()

const store = useSelfProcessStore()
const nodeSchema = NODE_TYPE_META[props.nodeType]
const otherNodes = (store.currentWorkflow?.nodes ?? []).filter((n) => n.id !== props.nodeId)

function addMapping(): void {
  emit('add', {
    sourceType: 'fixed_value',
    targetField: nodeSchema.io.inputs[0]?.name ?? 'value',
    fixedValue: ''
  })
}
</script>

<template>
  <div class="data-mapping">
    <div v-if="mappings.length === 0" class="mapping-empty">
      暂未配置数据映射
    </div>
    <div v-for="mapping in mappings" :key="mapping.id" class="mapping-item">
      <div class="mapping-row">
        <label class="mapping-field">
          <span class="mapping-label">目标字段</span>
          <select v-model="mapping.targetField" class="mapping-input">
            <option v-for="input in nodeSchema.io.inputs" :key="input.name" :value="input.name">
              {{ input.label }}
            </option>
          </select>
        </label>
        <label class="mapping-field">
          <span class="mapping-label">来源类型</span>
          <select v-model="mapping.sourceType" class="mapping-input">
            <option value="fixed_value">固定值</option>
            <option value="previous_output">上游节点输出</option>
            <option value="context_variable">上下文变量</option>
          </select>
        </label>
      </div>

      <div v-if="mapping.sourceType === 'fixed_value'" class="mapping-row">
        <label class="mapping-field">
          <span class="mapping-label">固定值</span>
          <input v-model="mapping.fixedValue" class="mapping-input" placeholder="输入固定值" />
        </label>
      </div>

      <div v-if="mapping.sourceType === 'previous_output'" class="mapping-row">
        <label class="mapping-field">
          <span class="mapping-label">来源节点</span>
          <select v-model="mapping.sourceNodeId" class="mapping-input">
            <option v-for="n in otherNodes" :key="n.id" :value="n.id">
              {{ n.label }}
            </option>
          </select>
        </label>
        <label class="mapping-field">
          <span class="mapping-label">输出字段</span>
          <select v-model="mapping.sourceField" class="mapping-input">
            <option v-for="output in (mapping.sourceNodeId
              ? NODE_TYPE_META[store.currentWorkflow?.nodes.find(n => n.id === mapping.sourceNodeId)?.type ?? 'task']?.io.outputs ?? []
              : [])" :key="output.name" :value="output.name">
              {{ output.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="mapping.sourceType === 'context_variable'" class="mapping-row">
        <label class="mapping-field">
          <span class="mapping-label">变量名</span>
          <input v-model="mapping.sourceField" class="mapping-input" placeholder="变量名称" />
        </label>
      </div>

      <button class="mapping-remove" @click="emit('remove', mapping.id)" title="删除映射">×</button>
    </div>
    <button class="mapping-add" @click="addMapping">+ 添加数据映射</button>
  </div>
</template>

<style scoped>
.data-mapping { display: flex; flex-direction: column; gap: 8px; }
.mapping-empty {
  font-size: 12px; color: var(--app-text-muted);
  padding: 8px; text-align: center;
}
.mapping-item {
  position: relative;
  padding: 10px;
  background: var(--app-card-soft);
  border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.mapping-row { display: flex; gap: 8px; }
.mapping-field { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.mapping-label { font-size: 10px; color: var(--app-text-muted); }
.mapping-input {
  padding: 4px 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 12px;
  outline: none;
}
.mapping-remove {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px;
  border: none; background: transparent;
  color: var(--app-text-muted); cursor: pointer;
  font-size: 16px; line-height: 1;
  border-radius: 4px;
}
.mapping-remove:hover { color: #dc2626; background: rgba(220,38,38,0.1); }
.mapping-add {
  padding: 6px;
  border: 1px dashed var(--app-border);
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.mapping-add:hover { color: #2563eb; border-color: #2563eb; }
</style>
