<script setup lang="ts">
defineProps<{
  label: string
  value: string
  variant?: 'default' | 'card'
}>()
</script>

<template>
  <div
    class="rounded-lg border border-(--app-border) px-3 py-2"
    :class="variant === 'card' ? 'bg-(--app-card)' : 'bg-(--app-input-bg)'"
  >
    <p class="text-xs text-(--app-text-muted)">{{ label }}</p>
    <p class="mt-1 text-sm text-(--app-text-primary)">{{ value }}</p>
  </div>
</template>
