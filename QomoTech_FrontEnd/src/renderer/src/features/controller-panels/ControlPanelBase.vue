<script setup lang="ts">
/**
 * 控制类面板的通用容器：圆角卡片 + 折叠头 + 展开内容槽。
 *
 * 共用的视觉/交互在此处一次性沉淀；min-height 等差异化样式由调用方通过 :class 直接覆盖
 * （这样 Tailwind 编译器仍能在每个调用方文件中静态扫到具体的 min-h-* 字符串）。
 *
 * 行为：
 * - expanded 通过 v-model:expanded 双向绑定，与 CollapsiblePanelHeader 联动
 * - contentAlwaysVisible=true 时内容区不随折叠隐藏（保留 DriverControlPanel 的现有行为）
 * - actionTarget 配合 @open-right-panel 用于跳转到嵌入式右侧面板
 */
import CollapsiblePanelHeader from '../../components/ui/CollapsiblePanelHeader.vue'

defineOptions({ inheritAttrs: false })

const expanded = defineModel<boolean>('expanded', { required: true })

defineProps<{
  /** 头部标题 */
  title: string
  /** 头部跳转按钮的目标视图标识（不传则不显示） */
  actionTarget?: string
  /** 内容区是否在折叠时仍渲染（默认 false：折叠时 v-show 隐藏） */
  contentAlwaysVisible?: boolean
}>()

defineEmits<{
  (e: 'open-right-panel', target: string): void
}>()
</script>

<template>
  <div
    v-bind="$attrs"
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
  >
    <CollapsiblePanelHeader
      v-model:expanded="expanded"
      :title="title"
      :action-target="actionTarget"
      @open-right-panel="(target: string) => $emit('open-right-panel', target)"
    />
    <div
      v-show="contentAlwaysVisible || expanded"
      class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1"
    >
      <slot />
    </div>
    <!-- 折叠时仍可见的底部区域（如 Camera/Laser 的「应用」按钮） -->
    <slot name="footer" />
  </div>
</template>
