<script setup lang="ts">
defineProps<{
  label: string
  modelValue: number
  unit: string
  step?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()
</script>

<template>
  <div class="ruv">
    <label class="ruv-label">{{ label }}</label>
    <div class="ruv-row">
      <input
        class="ruv-input"
        type="number"
        :step="step ?? 1"
        :value="modelValue"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
      <span class="ruv-unit">{{ unit }}</span>
    </div>
  </div>
</template>

<style scoped>
.ruv { display: flex; flex-direction: column; gap: 6px; }
.ruv-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--color-on-surface-variant); letter-spacing: 0.04em; text-transform: uppercase;
}
.ruv-row {
  display: flex; align-items: baseline; gap: 4px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-surface-container-highest) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: 8px;
}
.ruv-input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700;
  color: var(--color-primary); font-variant-numeric: tabular-nums;
  appearance: none; -webkit-appearance: none;
}
.ruv-input::-webkit-outer-spin-button,
.ruv-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ruv-unit {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
  color: var(--color-outline); flex-shrink: 0;
}
.ruv:focus-within .ruv-row { border-color: var(--color-primary); }
</style>
