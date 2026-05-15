<script setup lang="ts">
const props = defineProps<{
  label: string
  type?: 'number' | 'text' | 'select'
  disabled?: boolean
  min?: number
  step?: number | string
  options?: { value: number; label: string }[]
}>()

const modelValue = defineModel<number>({ required: true })

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  modelValue.value = Number(target.value)
}

function onSelectChange(e: Event) {
  const target = e.target as HTMLSelectElement
  modelValue.value = Number(target.value)
}
</script>

<template>
  <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
    {{ label }}
    <select
      v-if="type === 'select' && options"
      :value="modelValue"
      :disabled="disabled"
      class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @change="onSelectChange"
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
      @input="onInput"
    />
  </label>
</template>
