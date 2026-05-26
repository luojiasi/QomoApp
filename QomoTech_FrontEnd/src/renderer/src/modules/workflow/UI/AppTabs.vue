<script setup lang="ts">
// AppTabs.vue — 通用 Tab 切换组件
// 用法：
//   <AppTabs v-model="activeTab" :tabs="[{ key: 'canvas', label: '画布' }, { key: 'node', label: '节点' }]" />

defineProps<{
  tabs: { key: string; label: string }[]
}>()

const activeTab = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex shrink-0 border-b border-(--app-border)">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="relative flex-1 cursor-pointer border-0 bg-transparent px-3 py-2.5 text-[12px] font-medium transition-colors"
      :class="activeTab === tab.key
        ? 'text-(--app-text-primary)'
        : 'text-(--app-text-muted) hover:text-(--app-text-secondary)'"
      @click="activeTab = tab.key"
    >
      {{ tab.label }}
      <!-- 激活指示线 -->
      <span
        v-if="activeTab === tab.key"
        class="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-500"
      />
    </button>
  </div>
</template>
