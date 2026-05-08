<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'

const expanded = defineModel<boolean>('expanded', { required: true })

const props = defineProps<{
  title: string
  description?: string
  /**
   * 右侧面板要展示的目标标识。
   * 例如传入 'ControllerSettings'，由父组件自行决定显示哪个 View。
   */
  actionTarget?: string
  /**
   * 按钮文案，可选；不传则会根据 actionTarget 做简单映射。
   */
  actionLabel?: string
}>()

const emit = defineEmits<{
  (e: 'open-right-panel', target: string): void
}>()

function getActionLabel(target: string): string {
  // 常见目标的中文显示
  switch (target) {
    case 'ControllerSettings':
      return '控制器详细设置'
    default:
      return target
  }
}

const resolvedActionLabel = computed(() => {
  if (!props.actionTarget) return ''
  return props.actionLabel || getActionLabel(props.actionTarget)
})
</script>

<template>
  <header class="border-b border-(--app-border)">
    <div class="flex items-start justify-between gap-3">
      <button
        type="button"
        class="flex flex-1 items-start justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-100/90 dark:hover:bg-white/5"
        @click="expanded = !expanded"
      >
        <div>
          <h2 class="text-sm font-semibold tracking-wide text-(--app-text-primary)">{{ props.title }}</h2>
          <p v-if="props.description" class="mt-0.5 text-xs text-(--app-text-muted)">{{ props.description }}</p>
        </div>
        <Transition name="panel-arrow" mode="out-in">
          <SvgIcon
            :key="expanded ? 'expanded' : 'collapsed'"
            :icon-name="expanded ? 'icon-arrow-down' : 'icon-arrow-up'"
            class-name="text-1xl"
          />
        </Transition>
      </button>

      <button
        v-if="props.actionTarget"
        type="button"
        class="shrink-0 rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1 text-xs font-medium text-(--app-text-primary) transition hover:bg-(--app-card)"
        :title="`打开：${props.actionTarget}`"
        @click.stop="emit('open-right-panel', props.actionTarget)"
      >
        {{ resolvedActionLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.panel-arrow-enter-active,
.panel-arrow-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.panel-arrow-enter-from,
.panel-arrow-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
