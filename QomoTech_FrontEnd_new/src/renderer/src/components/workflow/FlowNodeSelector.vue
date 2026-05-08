<script setup lang="ts">
import { ref, computed } from 'vue'
import { NODE_DEFINITIONS, NODE_CATEGORY_META } from '../../configs/nodeDefinitions'
import type { NodeCategory } from '../../types/selfProcessTypes'

const props = defineProps<{
  x: number
  y: number
}>()

const emit = defineEmits<{
  select: [type: string]
  close: []
}>()

const searchText = ref('')
const categories = Object.keys(NODE_CATEGORY_META) as NodeCategory[]

const filteredDefinitions = computed(() => {
  const all = Object.values(NODE_DEFINITIONS)
  if (!searchText.value.trim()) return all
  const q = searchText.value.toLowerCase()
  return all.filter((d) =>
    d.label.toLowerCase().includes(q) ||
    d.type.toLowerCase().includes(q) ||
    d.description.toLowerCase().includes(q)
  )
})

const groupedDefinitions = computed(() => {
  const groups: { category: NodeCategory; defs: typeof filteredDefinitions.value }[] = []
  const defs = filteredDefinitions.value
  for (const cat of categories) {
    const catDefs = defs.filter((d) => d.category === cat)
    if (catDefs.length > 0) {
      groups.push({ category: cat, defs: catDefs })
    }
  }
  return groups
})

function onSelect(type: string): void {
  emit('select', type)
}

function onBackdropClick(): void {
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-100" @click="onBackdropClick"></div>
  <div
    class="fixed z-110 w-72 max-h-[480px] flex flex-col overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card) shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <!-- 标题 + 搜索 -->
    <div class="border-b border-(--app-border) px-3.5 py-2.5">
      <div class="text-[13px] font-semibold text-(--app-text-primary)">添加节点</div>
      <input
        v-model="searchText"
        class="mt-2 w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-xs text-(--app-text-primary) outline-none focus:border-blue-600"
        placeholder="搜索节点..."
        @click.stop
      />
    </div>

    <!-- 节点列表 -->
    <div class="flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
      <div v-if="groupedDefinitions.length === 0" class="px-3.5 py-6 text-center text-xs text-(--app-text-muted)">
        未找到匹配的节点类型
      </div>

      <div v-for="group in groupedDefinitions" :key="group.category" class="mb-1">
        <div class="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-(--app-text-muted)">
          <span>{{ NODE_CATEGORY_META[group.category].icon }}</span>
          <span>{{ NODE_CATEGORY_META[group.category].label }}</span>
        </div>
        <button
          v-for="def in group.defs"
          :key="def.type"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-100 hover:bg-(--app-card-soft)"
          @click="onSelect(def.type)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
            :style="{ background: def.color + '18' }"
          >
            {{ def.icon }}
          </span>
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-[12px] font-semibold text-(--app-text-primary)">{{ def.label }}</span>
            <span class="truncate text-[10px] leading-[1.3] text-(--app-text-muted)">{{ def.description }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
