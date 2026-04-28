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
  change: []
}>()

const otherNodes = props.nodes.filter((n) => n.id !== props.nodeId)

function addCondition(): void {
  emit('add', {
    label: '新跳转条件',
    when: 'on_success',
    targetNodeId: otherNodes[0]?.id ?? ''
  })
  emit('change')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="conditions.length === 0" class="p-2 text-center text-xs text-(--app-text-muted)">
      暂未配置跳转条件
    </div>
    <div
      v-for="cond in conditions"
      :key="cond.id"
      class="relative flex flex-col gap-1.5 rounded-lg border-l-[3px] border-l-violet-600 bg-(--app-card-soft) p-2.5"
    >
      <div class="flex gap-2">
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">标签</span>
          <input
            v-model="cond.label"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            placeholder="如: 成功时跳转"
            @input="emit('change')"
          />
        </label>
      </div>
      <div class="flex gap-2">
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">触发条件</span>
          <select
            v-model="cond.when"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option value="always">始终跳转</option>
            <option value="on_success">执行成功时</option>
            <option value="on_failure">执行失败时</option>
            <option value="expression">表达式为真时</option>
          </select>
        </label>
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">跳转到</span>
          <select
            v-model="cond.targetNodeId"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option v-for="n in otherNodes" :key="n.id" :value="n.id">
              {{ n.label }}
            </option>
          </select>
        </label>
      </div>
      <div v-if="cond.when === 'expression'" class="flex gap-2">
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">表达式</span>
          <input
            v-model="cond.expression"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            placeholder="success == true"
            @input="emit('change')"
          />
        </label>
      </div>
      <button
        class="absolute right-1 top-1 h-5 w-5 cursor-pointer rounded border-0 bg-transparent text-base leading-none text-(--app-text-muted) hover:bg-red-600/10 hover:text-red-600"
        @click="emit('remove', cond.id)"
        title="删除条件"
      >×</button>
    </div>
    <button
      class="cursor-pointer rounded-md border border-dashed border-(--app-border) bg-transparent p-1.5 text-xs text-(--app-text-muted) hover:border-violet-600 hover:text-violet-600"
      @click="addCondition"
    >
      + 添加跳转条件
    </button>
  </div>
</template>
