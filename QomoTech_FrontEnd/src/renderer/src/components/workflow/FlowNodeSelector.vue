<script setup lang="ts">
import type { NodeType } from '../../types/selfProcessTypes'
import { NODE_TYPE_META } from '../../configs/selfProcessConfigs'

const props = defineProps<{
  x: number
  y: number
}>()

const emit = defineEmits<{
  select: [type: NodeType]
  close: []
}>()

const nodeTypes: NodeType[] = ['task', 'condition', 'delay', 'loop']

function onSelect(type: NodeType): void {
  emit('select', type)
}

function onBackdropClick(): void {
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-100" @click="onBackdropClick"></div>
  <div
    class="fixed z-110 w-60 overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card) shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="border-b border-(--app-border) px-3.5 py-2.5 text-[13px] font-semibold text-(--app-text-primary)">
      选择节点类型
    </div>
    <div class="flex flex-col gap-0.5 p-1.5">
      <button
        v-for="nt in nodeTypes"
        :key="nt"
        class="flex cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-100 hover:bg-(--app-card-soft)"
        @click="onSelect(nt)"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          :style="{ background: NODE_TYPE_META[nt].color + '20' }"
        >
          {{ NODE_TYPE_META[nt].icon }}
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="text-[13px] font-semibold text-(--app-text-primary)">{{ NODE_TYPE_META[nt].label }}</span>
          <span class="text-[11px] leading-[1.3] text-(--app-text-muted)">
            {{ NODE_TYPE_META[nt].description }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
