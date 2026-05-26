<script setup lang="ts">
defineProps<{
  modelValue?: unknown
  options: readonly { label: string; value: string | number }[]
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label v-if="label" class="flex flex-col gap-1">
    <span class="text-[11px] font-medium text-(--app-text-secondary)">{{ label }}</span>
    <select
      :value="modelValue as string"
      :disabled="disabled"
      class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="!required" value="">{{ placeholder ?? '-- 选择 --' }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </label>
  <select
    v-else
    :value="modelValue as string"
    :disabled="disabled"
    class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="!required" value="">{{ placeholder ?? '-- 选择 --' }}</option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>
