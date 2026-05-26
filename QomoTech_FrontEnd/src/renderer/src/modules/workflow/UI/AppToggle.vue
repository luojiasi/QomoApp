<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  description?: string
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="flex cursor-pointer items-center justify-between">
    <span v-if="label" class="text-[12px] text-(--app-text-secondary)">{{ label }}</span>
    <button
      type="button"
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
      :class="modelValue ? 'bg-blue-600' : 'bg-(--app-border)'"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
  </label>
  <p v-if="description" class="mt-2 text-[11px] leading-relaxed text-(--app-text-muted)">
    {{ description }}
  </p>
</template>
