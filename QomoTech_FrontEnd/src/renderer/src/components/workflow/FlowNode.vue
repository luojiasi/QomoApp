<script setup lang="ts">
import type { WorkflowNode } from '../../types/selfProcessTypes'
import { NODE_TYPE_META, NODE_STATUS_COLOR, NODE_WIDTH } from '../../configs/selfProcessConfigs'
import { computed } from 'vue'

const props = defineProps<{
  node: WorkflowNode
  isSelected: boolean
  isRunning: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  dragStart: [id: string, event: MouseEvent]
  startConnect: [id: string]
  remove: [id: string]
}>()

const meta = computed(() => NODE_TYPE_META[props.node.type])
const statusColor = computed(() => NODE_STATUS_COLOR[props.node.runStatus] ?? '#94a3b8')
const borderColor = computed(() => {
  if (props.isSelected) return '#2563eb'
  if (props.node.runStatus === 'running') return '#2563eb'
  if (props.node.runStatus === 'success') return '#16a34a'
  if (props.node.runStatus === 'failed') return '#dc2626'
  return meta.value.color
})

const statusLabel: Record<string, string> = {
  idle: '空闲',
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '跳过'
}

function onMousedown(e: MouseEvent): void {
  if (props.isRunning) return
  emit('select', props.node.id)
  emit('dragStart', props.node.id, e)
  e.stopPropagation()
}

function onConnectClick(e: MouseEvent): void {
  e.stopPropagation()
  if (!props.isRunning) emit('startConnect', props.node.id)
}
</script>

<template>
  <div
    class="absolute z-10 select-none overflow-visible rounded-xl border-2 border-solid bg-(--app-card) transition-[box-shadow,border-color] duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
    :class="[
      node.runStatus === 'running' ? 'animate-pulse' : '',
      isRunning ? 'cursor-default' : 'cursor-pointer'
    ]"
    :style="{
      left: node.position.x + 'px',
      top: node.position.y + 'px',
      width: NODE_WIDTH + 'px',
      borderColor: borderColor,
      boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.3)' : undefined
    }"
    @mousedown.prevent="onMousedown"
  >
    <div
      class="flex items-center gap-1.5 rounded-t-[10px] px-3 py-1.5 text-xs font-semibold"
      :style="{ background: meta.color + '18' }"
    >
      <span class="text-sm">{{ meta.icon }}</span>
      <span class="flex-1">{{ meta.label }}</span>
      <button
        v-if="!isRunning"
        class="h-[18px] w-[18px] cursor-pointer rounded border-0 bg-transparent text-base leading-none text-(--app-text-muted) hover:bg-red-600/10 hover:text-red-600"
        @mousedown.stop
        @click="emit('remove', node.id)"
        title="删除节点"
      >×</button>
    </div>

    <div class="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 text-[13px] text-(--app-text-primary)">
      <span>{{ node.label }}</span>
    </div>

    <div class="px-3 pb-1.5 pt-1 text-[11px]">
      <span :style="{ color: statusColor }">
        ● {{ statusLabel[node.runStatus] ?? '空闲' }}
      </span>
    </div>

    <!-- 输出连接点 -->
    <div
      class="absolute bottom-[-12px] left-1/2 z-20 flex -translate-x-1/2 items-center justify-center"
      :class="isRunning ? 'cursor-default' : 'cursor-crosshair'"
      @mousedown="onConnectClick"
      title="拖拽连接下一个节点"
    >
      <div
        class="h-2.5 w-2.5 rounded-full border-2 border-(--app-card) shadow-[0_0_0_1px_var(--app-border)]"
        :style="{ background: meta.color }"
      ></div>
    </div>

    <!-- 输入连接点 -->
    <div class="absolute left-1/2 top-[-12px] z-20 flex -translate-x-1/2 items-center justify-center">
      <div
        class="h-2.5 w-2.5 rounded-full border-2 border-(--app-card) shadow-[0_0_0_1px_var(--app-border)]"
        :style="{ background: meta.color }"
      ></div>
    </div>
  </div>
</template>
