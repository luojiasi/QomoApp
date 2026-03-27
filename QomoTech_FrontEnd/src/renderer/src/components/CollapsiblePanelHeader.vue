<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'

const expanded = defineModel<boolean>('expanded', { required: true })

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="border-b border-(--app-border) pb-3">
    <button
      type="button"
      class="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-100/90 dark:hover:bg-white/5"
      @click="expanded = !expanded"
    >
      <div>
        <h2 class="text-sm font-semibold tracking-wide text-(--app-text-primary)">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-xs text-(--app-text-muted)">{{ description }}</p>
      </div>
      <Transition name="panel-arrow" mode="out-in">
        <SvgIcon
          :key="expanded ? 'expanded' : 'collapsed'"
          :icon-name="expanded ? 'icon-arrow-down' : 'icon-arrow-up'"
          class-name="text-1xl"
        />
      </Transition>
    </button>
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
