<script setup lang="ts">
import type { GeneralSettingsForm } from '../../composables/canvas/useGeneralSettings'

const props = defineProps<{
  form: GeneralSettingsForm
}>()

const emit = defineEmits<{
  'update:form': [patch: Partial<GeneralSettingsForm>]
  'reset': []
}>()

function updateField<K extends keyof GeneralSettingsForm>(key: K, value: GeneralSettingsForm[K]) {
  emit('update:form', { [key]: value } as Partial<GeneralSettingsForm>)
}
</script>

<template>
  <div class="general-panel">
    <div class="gp-header">
      <span class="gp-title">通用设置</span>
      <button class="gp-reset" @click="emit('reset')">恢复默认</button>
    </div>

    <div class="gp-fields">
      <label class="gp-field">
        <span>默认项目名</span>
        <input
          type="text"
          :value="form.defaultProjectName"
          @input="updateField('defaultProjectName', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="gp-field">
        <span>挤出高度</span>
        <input
          type="number"
          :value="form.defaultExtrudeHeight"
          @input="updateField('defaultExtrudeHeight', Number(($event.target as HTMLInputElement).value))"
          min="0.1" step="0.5"
        />
      </label>

      <label class="gp-field">
        <span>开口补偿</span>
        <input
          type="number"
          :value="form.defaultOpenSize"
          @input="updateField('defaultOpenSize', Number(($event.target as HTMLInputElement).value))"
          min="0" step="0.1"
        />
      </label>

      <label class="gp-field">
        <span>倾斜角度</span>
        <input
          type="number"
          :value="form.defaultTiltAngle"
          @input="updateField('defaultTiltAngle', Number(($event.target as HTMLInputElement).value))"
          step="1"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.general-panel {
  display: flex;
  flex-direction: column;
  color: #d4d4d8;
}
.gp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}
.gp-title { font-size: 14px; font-weight: 600; }
.gp-reset {
  font-size: 11px;
  padding: 3px 10px;
  background: #27272a;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
}
.gp-reset:hover { background: #3f3f46; color: #e4e4e7; }

.gp-fields {
  padding: 4px 14px 10px;
}
.gp-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.gp-field span {
  width: 80px;
  flex-shrink: 0;
  font-size: 12px;
  color: #a1a1aa;
}
.gp-field input[type="number"],
.gp-field input[type="text"] {
  flex: 1;
  width: 0;
  padding: 4px 6px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: right;
}
.gp-field input:focus { outline: none; border-color: #3b82f6; }
</style>
