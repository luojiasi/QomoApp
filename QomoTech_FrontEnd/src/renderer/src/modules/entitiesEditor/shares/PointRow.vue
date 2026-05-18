<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  x: number
  y: number
  entityId: string
  xField: string
  yField: string
  step?: number
  compact?: boolean
}>(), {
  step: 1,
  compact: false,
})

const emit = defineEmits<{
  'update': [field: string, value: number, entityId: string]
}>()
</script>

<template>
  <div class="point-row">
    <span :class="compact ? 'pt-num' : 'pt-label'">{{ label }}</span>
    <label class="field"><span>X：</span>
      <input type="number" :value="x" :step="step"
        @input="emit('update', xField, +($event.target as HTMLInputElement).value, entityId)" />
    </label>
    <label class="field"><span>Y：</span>
      <input type="number" :value="y" :step="step"
        @input="emit('update', yField, +($event.target as HTMLInputElement).value, entityId)" />
    </label>
  </div>
</template>

<style scoped>
.point-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.pt-label {
  width: 52px;
  font-size: 11px;
  color: #a1a1aa;
  flex-shrink: 0;
}
.pt-num {
  width: 18px;
  font-size: 11px;
  color: #52525b;
  text-align: center;
  flex-shrink: 0;
}
.point-row .field { margin-bottom: 0; flex: 1; }
.point-row .field input[type="number"] { width: 56px; }
</style>
