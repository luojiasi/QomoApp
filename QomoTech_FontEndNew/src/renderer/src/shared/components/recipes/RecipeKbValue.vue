<script setup lang="ts">
defineProps<{ label: string; coeff: 'K' | 'B'; modelValue: number; step?: number }>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()
</script>

<template>
  <div class="rkb">
    <label v-if="label" class="rkb-label">{{ label }}</label>
    <div class="rkb-row">
      <span class="rkb-coeff">{{ coeff }}</span>
      <input
        class="rkb-input"
        type="number"
        :step="step ?? 0.01"
        :value="modelValue"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
.rkb { display: flex; flex-direction: column; gap: 6px; }
.rkb-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--color-on-surface-variant); letter-spacing: 0.04em; text-transform: uppercase;
}
.rkb-row {
  display: flex; align-items: center; gap: 2px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-surface-container-highest) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: 8px;
}
.rkb-coeff {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
  color: var(--color-tertiary); flex-shrink: 0;
}
.rkb-input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700;
  color: var(--color-on-surface); font-variant-numeric: tabular-nums;
  text-align: center;
  appearance: none; -webkit-appearance: none;
}
.rkb-input::-webkit-outer-spin-button,
.rkb-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.rkb:focus-within .rkb-row { border-color: var(--color-primary); }
</style>
