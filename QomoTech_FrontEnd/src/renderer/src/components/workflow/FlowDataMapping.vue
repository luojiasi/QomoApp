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
  change: []
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
  emit('change')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="mappings.length === 0" class="p-2 text-center text-xs text-(--app-text-muted)">
      暂未配置数据映射
    </div>
    <div
      v-for="mapping in mappings"
      :key="mapping.id"
      class="relative flex flex-col gap-1.5 rounded-lg bg-(--app-card-soft) p-2.5"
    >
      <div class="flex gap-2">
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">目标字段</span>
          <select
            v-model="mapping.targetField"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option v-for="input in nodeSchema.io.inputs" :key="input.name" :value="input.name">
              {{ input.label }}
            </option>
          </select>
        </label>
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">来源类型</span>
          <select
            v-model="mapping.sourceType"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option value="fixed_value">固定值</option>
            <option value="previous_output">上游节点输出</option>
            <option value="context_variable">上下文变量</option>
          </select>
        </label>

        <label v-if="mapping.sourceType === 'fixed_value'"  class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">固定值</span>
          <input
            v-model="mapping.fixedValue"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            placeholder="输入固定值"
            @input="emit('change')"
          />
        </label>
        <div v-if="mapping.sourceType === 'previous_output'" class="flex flex-1">
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">来源节点</span>
          <select
            v-model="mapping.sourceNodeId"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option v-for="n in otherNodes" :key="n.id" :value="n.id">
              {{ n.label }}
            </option>
          </select>
        </label>
        <label class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">输出字段</span>
          <select
            v-model="mapping.sourceField"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            @change="emit('change')"
          >
            <option v-for="output in (mapping.sourceNodeId
              ? NODE_TYPE_META[store.currentWorkflow?.nodes.find(n => n.id === mapping.sourceNodeId)?.type ?? 'task']?.io.outputs ?? []
              : [])" :key="output.name" :value="output.name">
              {{ output.label }}
            </option>
          </select>
        </label>
      </div>
      <label v-if="mapping.sourceType === 'context_variable'" class="flex flex-1 flex-col gap-0.5">
          <span class="text-[10px] text-(--app-text-muted)">变量名</span>
          <input
            v-model="mapping.sourceField"
            class="rounded border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs text-(--app-text-primary) outline-none"
            placeholder="变量名称"
            @input="emit('change')"
          />
        </label>
      </div>

      <button
        class="absolute right-1 top-1 h-5 w-5 cursor-pointer rounded border-0 bg-transparent text-base leading-none text-(--app-text-muted) hover:bg-red-600/10 hover:text-red-600"
        @click="emit('remove', mapping.id)"
        title="删除映射"
      >×</button>
    </div>
    <button
      class="cursor-pointer rounded-md border border-dashed border-(--app-border) bg-transparent p-1.5 text-xs text-(--app-text-muted) hover:border-blue-600 hover:text-blue-600"
      @click="addMapping"
    >
      + 添加数据映射
    </button>
  </div>
</template>
