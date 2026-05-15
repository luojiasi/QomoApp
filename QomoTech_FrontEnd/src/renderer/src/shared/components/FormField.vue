<script setup lang="ts">
defineProps<{
  label: string
  modelValue: number | string
  type?: 'number' | 'text' | 'select'
  disabled?: boolean
  min?: number
  step?: number | string
  options?: { value: number; label: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | string]
}>()
</script>

<template>
  <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
    {{ label }}
    <select
      v-if="type === 'select' && options"
      :value="modelValue"
      :disabled="disabled"
      class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @change="emit('update:modelValue', Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <input
      v-else
      :value="modelValue"
      :type="type ?? 'number'"
      :min="min"
      :step="step ?? 'any'"
      :disabled="disabled"
      class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @input="emit('update:modelValue', type === 'number' ? Number(($event.target as HTMLInputElement).value) : ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>
