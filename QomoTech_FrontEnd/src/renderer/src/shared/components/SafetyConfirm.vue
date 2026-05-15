<script setup lang="ts">
defineProps<{
  modelValue: boolean
  disabled?: boolean
  message: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
    <label class="flex items-start gap-2 text-sm text-(--app-text-primary)">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="mt-1"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ message }}</span>
    </label>
  </div>
</template>
