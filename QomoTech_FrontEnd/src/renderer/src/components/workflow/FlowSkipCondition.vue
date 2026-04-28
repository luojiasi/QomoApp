<script setup lang="ts">
import type { SkipCondition, WorkflowNode } from '../../types/selfProcessTypes'

const props = defineProps<{
  nodeId: string
  conditions: SkipCondition[]
  nodes: WorkflowNode[]
}>()

const emit = defineEmits<{
  add: [condition: Omit<SkipCondition, 'id'>]
  remove: [conditionId: string]
}>()

const otherNodes = props.nodes.filter((n) => n.id !== props.nodeId)

function addCondition(): void {
  emit('add', {
    label: '新跳转条件',
    when: 'on_success',
    targetNodeId: otherNodes[0]?.id ?? ''
  })
}
</script>

<template>
  <div class="skip-condition">
    <div v-if="conditions.length === 0" class="condition-empty">
      暂未配置跳转条件
    </div>
    <div v-for="cond in conditions" :key="cond.id" class="condition-item">
      <div class="condition-row">
        <label class="condition-field">
          <span class="condition-label">标签</span>
          <input v-model="cond.label" class="condition-input" placeholder="如: 成功时跳转" />
        </label>
      </div>
      <div class="condition-row">
        <label class="condition-field">
          <span class="condition-label">触发条件</span>
          <select v-model="cond.when" class="condition-input">
            <option value="always">始终跳转</option>
            <option value="on_success">执行成功时</option>
            <option value="on_failure">执行失败时</option>
            <option value="expression">表达式为真时</option>
          </select>
        </label>
        <label class="condition-field">
          <span class="condition-label">跳转到</span>
          <select v-model="cond.targetNodeId" class="condition-input">
            <option v-for="n in otherNodes" :key="n.id" :value="n.id">
              {{ n.label }}
            </option>
          </select>
        </label>
      </div>
      <div v-if="cond.when === 'expression'" class="condition-row">
        <label class="condition-field">
          <span class="condition-label">表达式</span>
          <input v-model="cond.expression" class="condition-input" placeholder="{{ $self.output.matched }} === true" />
        </label>
      </div>
      <button class="condition-remove" @click="emit('remove', cond.id)" title="删除条件">×</button>
    </div>
    <button class="condition-add" @click="addCondition">+ 添加跳转条件</button>
  </div>
</template>

<style scoped>
.skip-condition { display: flex; flex-direction: column; gap: 8px; }
.condition-empty {
  font-size: 12px; color: var(--app-text-muted);
  padding: 8px; text-align: center;
}
.condition-item {
  position: relative;
  padding: 10px;
  background: var(--app-card-soft);
  border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px;
  border-left: 3px solid #7c3aed;
}
.condition-row { display: flex; gap: 8px; }
.condition-field { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.condition-label { font-size: 10px; color: var(--app-text-muted); }
.condition-input {
  padding: 4px 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 12px;
  outline: none;
}
.condition-remove {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px;
  border: none; background: transparent;
  color: var(--app-text-muted); cursor: pointer;
  font-size: 16px; line-height: 1;
  border-radius: 4px;
}
.condition-remove:hover { color: #dc2626; background: rgba(220,38,38,0.1); }
.condition-add {
  padding: 6px;
  border: 1px dashed var(--app-border);
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.condition-add:hover { color: #7c3aed; border-color: #7c3aed; }
</style>
