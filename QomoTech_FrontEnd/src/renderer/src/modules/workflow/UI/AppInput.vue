<script setup lang="ts">
defineProps<{
  modelValue?: unknown
  placeholder?: string
  label?: string
  disabled?: boolean
  readonly?: boolean
  type?: string
  autofocus?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  keydown: [event: KeyboardEvent]
}>()
</script>

<template>
  <label v-if="label" class="flex flex-col gap-1">
    <span class="text-[11px] font-medium text-(--app-text-secondary)">{{ label }}</span>
    <input
      :type="type ?? 'text'"
      :value="modelValue as string"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600 disabled:opacity-50 read-only:text-(--app-text-muted)"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="$emit('keydown', $event)"
    />
  </label>
  <input
    v-else
    :type="type ?? 'text'"
    :value="modelValue as string"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :autofocus="autofocus"
    class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600 disabled:opacity-50 read-only:text-(--app-text-muted)"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @keydown="$emit('keydown', $event)"
  />
</template>
