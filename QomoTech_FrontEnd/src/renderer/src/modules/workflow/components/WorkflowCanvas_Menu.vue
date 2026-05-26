<script setup lang="ts">
// WorkflowCanvas_Menu.vue — 画布右键上下文菜单（按分类添加节点）
import { getNodePickerGroups } from '../utils/nodeRegistryUtils'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'

defineProps<{ show: boolean; x: number; y: number }>()
const emit = defineEmits<{ add: [nodeType: string]; close: [] }>()

const groups = getNodePickerGroups()
</script>

<template>
  <div
    v-if="show"
    class="fixed z-50 min-w-[180px] max-h-[320px] overflow-y-auto rounded-xl border border-(--app-border) bg-(--app-card) py-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <template v-for="group in groups" :key="group.category">
      <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--app-text-muted)">
        {{ group.label }}
      </div>
      <button
        v-for="def in group.nodes"
        :key="def.type"
        class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[13px] text-(--app-text-primary) hover:bg-(--app-card-soft)"
        @click="emit('add', def.type)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs"
          :style="{
            background: NODE_CATEGORY_STYLES[def.category].headerBg,
            color: NODE_CATEGORY_STYLES[def.category].headerText
          }"
        >
          {{ def.icon }}
        </span>
        <span class="truncate">{{ def.displayName }}</span>
      </button>
    </template>

    <div class="my-1 border-t border-(--app-border)" />

    <button
      class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-2 text-left text-[13px] text-(--app-text-muted) hover:bg-(--app-card-soft)"
      @click="emit('close')"
    >
      取消
    </button>
  </div>
</template>
