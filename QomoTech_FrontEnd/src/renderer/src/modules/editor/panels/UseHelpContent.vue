<script setup lang="ts">
import { ref } from 'vue'
import CollapsiblePanelHeader from '@/shared/components/CollapsiblePanelHeader.vue'

const isExpanded = ref(true)

interface ShortcutEntry {
  label: string
  keys: string[]
}

interface ShortcutGroup {
  title: string
  items: ShortcutEntry[]
}

const groups: ShortcutGroup[] = [
  {
    title: '速度调节',
    items: [
      { label: '0.01 mm/s', keys: ['F1'] },
      { label: '0.1 mm/s', keys: ['F2'] },
      { label: '1 mm/s', keys: ['F3'] },
      { label: '5 mm/s', keys: ['F4'] },
    ]
  },
  {
    title: '轴移动',
    items: [
      { label: 'Y+ / Y−', keys: ['↑', '↓'] },
      { label: 'X+ / X−', keys: ['←', '→'] },
      { label: 'Z+ / Z−', keys: ['PageUp', 'PageDown'] },
      { label: 'U 轴旋转 (顺/逆)', keys: ['Ctrl', '↑', '↓'] },
      { label: 'R 轴旋转 (顺/逆)', keys: ['Ctrl', '←', '→'] },
      { label: 'Alt + 方向键 (带设定)', keys: ['Alt', '↑↓←→'] },
    ]
  },
  {
    title: 'IO 控制',
    items: [
      { label: '吹气开关', keys: ['Q'] },
      { label: '灯光开关', keys: ['W'] },
      { label: '激光开关', keys: ['Ctrl', 'E'] },
      { label: '点射激光', keys: ['R'] },
      { label: '快速回设定点', keys: ['H'] },
    ]
  },
  {
    title: '2D 绘图',
    items: [
      { label: '选择', keys: ['Esc'] },
      { label: '平移', keys: ['M'] },
      { label: '直线', keys: ['L'] },
      { label: '圆弧', keys: ['A'] },
      { label: '圆', keys: ['C'] },
      { label: '贝塞尔曲线', keys: ['B'] },
      { label: '删除选中', keys: ['Delete'] },
    ]
  },
  {
    title: '文件',
    items: [
      { label: '撤销', keys: ['Ctrl', 'Z'] },
      { label: '重做', keys: ['Ctrl', 'Y'] },
      { label: '保存', keys: ['Ctrl', 'S'] },
    ]
  },
]
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isExpanded ? 'min-h-[min(200px,36vh)]' : ''"
  >
    <CollapsiblePanelHeader v-model:expanded="isExpanded" title="操作说明" />

    <div
      v-if="isExpanded"
      class="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        v-for="group in groups"
        :key="group.title"
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3"
      >
        <p class="mb-2 text-xs font-semibold text-(--app-text-primary)">{{ group.title }}</p>
        <div class="space-y-1.5">
          <div
            v-for="item in group.items"
            :key="item.label"
            class="flex items-center justify-between gap-2"
          >
            <span class="text-xs text-(--app-text-secondary)">{{ item.label }}</span>
            <span class="flex items-center gap-1">
              <kbd
                v-for="(key, ki) in item.keys"
                :key="ki"
                class="inline-flex items-center justify-center rounded-md border border-(--app-border) bg-(--app-card) px-1.5 py-0.5 text-[10px] font-medium leading-none text-(--app-text-muted) shadow-sm"
                :class="key.length > 1 ? 'min-w-[3ch]' : 'min-w-[2ch]'"
              >
                {{ key }}
              </kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
