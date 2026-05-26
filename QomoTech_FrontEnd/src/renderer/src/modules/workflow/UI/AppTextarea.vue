<script setup lang="ts">
defineProps<{
  modelValue?: unknown
  placeholder?: string
  label?: string
  rows?: number
  required?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label class="col-span-full flex flex-col gap-1">
    <span v-if="label" class="text-[11px] font-medium text-(--app-text-secondary)">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </span>
    <textarea
      :value="modelValue as string"
      :placeholder="placeholder"
      :rows="rows ?? 6"
      class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[12px] text-(--app-text-primary) outline-none focus:border-blue-600"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </label>
</template>
