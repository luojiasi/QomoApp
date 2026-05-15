<script setup lang="ts">
defineProps<{
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>
