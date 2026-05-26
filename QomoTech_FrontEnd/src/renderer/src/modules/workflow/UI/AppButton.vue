<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'success' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    :disabled="disabled"
    :title="title"
    class="cursor-pointer rounded-lg border font-semibold transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    :class="[
      size === 'sm'
        ? 'px-2.5 py-1 text-xs'
        : 'px-5 py-2 text-[13px]',
      variant === 'success'
        ? 'border-green-500/30 bg-green-600 text-white shadow-[0_8px_18px_rgba(22,163,74,0.18)] enabled:hover:-translate-y-px enabled:hover:bg-green-700'
        : variant === 'danger'
          ? 'border-red-500/30 bg-red-600 text-white shadow-[0_8px_18px_rgba(220,38,38,0.2)] hover:-translate-y-px hover:bg-red-700'
          : variant === 'ghost'
            ? 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-secondary) hover:text-(--app-text-primary)'
            : 'border-blue-500/30 bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] enabled:hover:-translate-y-px enabled:hover:bg-blue-700'
    ]"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
