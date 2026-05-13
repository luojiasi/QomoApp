<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { getNodeDefinition, NODE_WIDTH } from './selfProcessConfig'
import { useSelfProcessStore } from './useSelfProcessStore'
import type { NodePort } from '@/types/selfProcessTypes'

const props = defineProps<NodeProps>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const store = useSelfProcessStore()

const nodeType = computed(() => (props.data?.type as string) ?? 'unknown')
const label = computed(() => (props.data?.label as string) ?? props.id)
const def = computed(() => getNodeDefinition(nodeType.value))
const status = computed(() => (props.data?.status as string) ?? 'idle')
const workflowRunning = computed(() => (props.data?.workflowRunning as boolean) ?? false)

const typeColor = computed(() => def.value?.color ?? '#64748b')
const icon = computed(() => def.value?.icon ?? '???')
const typeLabel = computed(() => def.value?.label ?? nodeType.value)

/** 用户自定义的额外输入端口 */
const extraInputs = computed(() => (props.data?.extraInputs as NodePort[]) ?? [])

/** 所有输入端口的合集（定义端口 + 额外端口） */
const allInputs = computed(() => [...(def.value?.inputs ?? []), ...extraInputs.value])

const hasInputs = computed(() => allInputs.value.length > 0)
const hasOutputs = computed(() => (def.value?.outputs.length ?? 0) > 0)

// 运行中时节点类型色变灰，停止后恢复
const color = computed(() => workflowRunning.value ? '#94a3b8' : typeColor.value)

const statusColor = computed(() => {
  const map: Record<string, string> = {
    idle: color.value + '80',
    running: '#3b82f6',
    success: '#22c55e',
    failed: '#ef4444'
  }
  return map[status.value] ?? color.value + '80'
})

const isRunning = computed(() => status.value === 'running')

const showBreakpointToggle = computed(() => store.breakpointEnabled && !store.isRunning)
const hasBreakpoint = computed(() => store.breakpointNodeIds.has(props.id))
const isPausedHere = computed(() => store.breakpointPaused && store.breakpointPausedNodeId === props.id)

function onToggleBreakpoint(e: MouseEvent): void {
  e.stopPropagation()
  store.toggleBreakpoint(props.id)
}

function outputHandleColor(outputName: string): string {
  if (outputName === 'error') return '#ef4444'
  if (nodeType.value === 'flow.condition') {
    return outputName === 'true' ? '#3b82f6' : '#ef4444'
  }
  return color.value
}

function outputHandleOffset(total: number, idx: number): string {
  if (total <= 1) return ''
  const span = Math.min(70, total * 24)
  const step = span / (total - 1)
  const offset = -span / 2 + idx * step
  return `${offset}px`
}
</script>

<template>
  <div
    class="flex flex-col rounded-xl border-2 bg-(--app-card) text-[13px] transition-all duration-300"
    :class="{ 'animate-pulse': isRunning }"
    :style="{
      width: NODE_WIDTH + 'px',
      borderColor: props.selected ? '#facc15' : statusColor,
      boxShadow: props.selected ? '0 0 0 2px rgba(250,204,21,0.35)' : undefined
    }"
  >
    <!-- 输入 Handle（定义端口 + 自定义额外端口，紫色为额外端口） -->
    <template v-if="hasInputs">
      <Handle
        v-for="(input, idx) in allInputs"
        :key="input.name"
        :id="input.name"
        type="target"
        :position="Position.Top"
        class="h-3! w-3! border-2!"
        :style="{
          borderColor: 'var(--app-card)',
          background: input.name.startsWith('__extra_') ? '#a78bfa' : 'var(--app-text-muted)',
          marginLeft: outputHandleOffset(allInputs.length, idx)
        }"
        :title="input.displayName"
      />
    </template>
    <Handle
      v-else
      type="target"
      :position="Position.Top"
      class="h-3! w-3! border-2!"
      :style="{ borderColor: 'var(--app-card)', background: 'var(--app-text-muted)' }"
    />

    <!-- 头部 -->
    <div
      class="flex items-center gap-1.5 rounded-t-[10px] px-3 py-1.5 text-xs font-semibold"
      :style="{ background: color + '18' }"
    >
      <span class="inline-block h-1.5 w-1.5 rounded-full" :style="{ background: statusColor }" />
      <span>{{ icon }}</span>
      <span class="flex-1 truncate">{{ typeLabel }}</span>
      <button
        class="h-[18px] w-[18px] cursor-pointer rounded border-0 bg-transparent text-base leading-none text-(--app-text-muted) hover:bg-red-600/10 hover:text-red-600"
        @click.stop="emit('remove', props.id)"
        title="删除节点"
      >×</button>
    </div>

    <!-- 标签 -->
    <div class="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 font-medium text-(--app-text-primary)">
      {{ label }}
    </div>

    <!-- 断点暂停指示 -->
    <div
      v-if="isPausedHere"
      class="mx-3 mb-1 rounded bg-yellow-500 px-2 py-0.5 text-center text-[10px] font-bold text-white"
    >
      ⏸ 断点暂停
    </div>

    <!-- 断点开关 -->
    <div
      v-if="showBreakpointToggle"
      class="absolute -right-1.5 -bottom-1.5 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-2 shadow transition-colors duration-150"
      :style="{
        borderColor: 'var(--app-card)',
        background: hasBreakpoint ? '#ef4444' : '#64748b'
      }"
      :title="hasBreakpoint ? '取消断点' : '设置断点'"
      @click="onToggleBreakpoint"
    />

    <!-- 输出 Handle（多端口） -->
    <template v-if="hasOutputs">
      <Handle
        v-for="(output, idx) in def?.outputs ?? []"
        :key="output.name"
        :id="output.name"
        type="source"
        :position="Position.Bottom"
        class="h-3! w-3! border-2! handle-output"
        :class="{ 'handle-output--error': output.name === 'error' }"
        :style="{
          borderColor: 'var(--app-card)',
          background: outputHandleColor(output.name),
          marginLeft: outputHandleOffset(def?.outputs.length ?? 1, idx)
        }"
        :title="output.displayName"
      />
    </template>
  </div>
</template>
