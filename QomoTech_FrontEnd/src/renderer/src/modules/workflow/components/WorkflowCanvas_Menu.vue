<script setup lang="ts">
// WorkflowCanvas_Menu.vue — 画布右键上下文菜单（按分类添加节点）
import { getNodePickerGroups } from '../utils/nodeRegistryUtils'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'

defineProps<{ show: boolean; x: number; y: number }>()
const emit = defineEmits<{ add: [nodeType: string]; close: [] }>()

const groups = getNodePickerGroups()
</script>

<template>
  <Transition name="menu">
    <div
      v-if="show"
      class="fixed z-50 w-[410px] rounded-xl border border-white/20 bg-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.10)] backdrop-blur-2xl"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <!-- 节点列表：可滚动 -->
      <div class="wf-scroll-y max-h-[340px] py-1">
        <template v-for="group in groups" :key="group.category">
          <div class="border-b border-black/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--app-text-muted)">
            {{ group.label }}
          </div>
          <div class="grid grid-cols-2">
            <button
              v-for="def in group.nodes"
              :key="def.type"
              class="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-[12px] text-(--app-text-primary) transition-all duration-150 hover:bg-black/6 hover:scale-105"
              @click="emit('add', def.type)"
            >
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px]"
                :style="{
                  background: NODE_CATEGORY_STYLES[def.category].headerBg,
                  color: NODE_CATEGORY_STYLES[def.category].headerText
                }"
              >
                {{ def.icon }}
              </span>
              <span class="truncate">{{ def.displayName }}</span>
            </button>
          </div>
        </template>
      </div>

      <!-- 取消按钮：固定底部 -->
      <div class="rounded-b-xl border-t border-black/10 bg-black/6">
        <button
          class="flex w-full cursor-pointer items-center justify-center border-0 bg-transparent px-4 py-2.5 text-[12px] font-medium text-(--app-text-muted) transition-all duration-150 hover:bg-red-600/10 hover:text-red-500 hover:scale-105"
          @click="emit('close')"
        >
          取消
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.menu-enter-active {
  transition: opacity 0.35s ease-out;
}
.menu-leave-active {
  transition: opacity 0.35s ease-in;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}
</style>
