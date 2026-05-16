<script setup lang="ts">
import { ref } from 'vue'
import type { Scene3DForm } from '../../composables/preview/useScene3DSettings'

const props = defineProps<{
  form: Scene3DForm
}>()

const emit = defineEmits<{
  'update:form': [patch: Partial<Scene3DForm>]
  'reset': []
}>()

function updateField<K extends keyof Scene3DForm>(key: K, value: Scene3DForm[K]) {
  emit('update:form', { [key]: value } as Partial<Scene3DForm>)
}

type Section = 'camera' | 'lighting' | 'grid' | 'axes'

const expanded = ref<Record<Section, boolean>>({
  camera: false,
  lighting: false,
  grid: false,
  axes: false,
})

function toggle(s: Section) {
  expanded.value[s] = !expanded.value[s]
}

const sections: { id: Section; label: string }[] = [
  { id: 'camera', label: '相机' },
  { id: 'lighting', label: '光照' },
  { id: 'grid', label: '网格' },
  { id: 'axes', label: '坐标轴 & 背景' },
]
</script>

<template>
  <div class="scene3d-panel">
    <div class="s3d-header">
      <span class="s3d-title">3D 场景参数</span>
      <button class="s3d-reset" @click="emit('reset')">恢复默认</button>
    </div>

    <div class="s3d-toggles">
      <label class="s3d-toggle">
        <input type="checkbox" :checked="form.showGrid" @change="updateField('showGrid', ($event.target as HTMLInputElement).checked)" />
        <span>显示网格</span>
      </label>
      <label class="s3d-toggle">
        <input type="checkbox" :checked="form.showAxes" @change="updateField('showAxes', ($event.target as HTMLInputElement).checked)" />
        <span>显示坐标轴</span>
      </label>
    </div>

    <div v-for="sec in sections" :key="sec.id" class="s3d-section">
      <button class="s3d-section-btn" @click="toggle(sec.id)">
        <span class="s3d-arrow" :class="{ open: expanded[sec.id] }">▸</span>
        <span>{{ sec.label }}</span>
      </button>

      <div v-show="expanded[sec.id]" class="s3d-fields">

        <!-- ── 相机 ── -->
        <template v-if="sec.id === 'camera'">
          <label class="s3d-field"><span>位置 X</span><input type="number" :value="form.cameraX" @input="updateField('cameraX', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
          <label class="s3d-field"><span>位置 Y</span><input type="number" :value="form.cameraY" @input="updateField('cameraY', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
          <label class="s3d-field"><span>位置 Z</span><input type="number" :value="form.cameraZ" @input="updateField('cameraZ', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
          <label class="s3d-field"><span>FOV</span><input type="number" :value="form.cameraFov" @input="updateField('cameraFov', Number(($event.target as HTMLInputElement).value))" min="10" max="120" step="1" /></label>
          <label class="s3d-field"><span>近裁面</span><input type="number" :value="form.cameraNear" @input="updateField('cameraNear', Number(($event.target as HTMLInputElement).value))" step="0.01" /></label>
          <label class="s3d-field"><span>远裁面</span><input type="number" :value="form.cameraFar" @input="updateField('cameraFar', Number(($event.target as HTMLInputElement).value))" step="100" /></label>
        </template>

        <!-- ── 光照 ── -->
        <template v-if="sec.id === 'lighting'">
          <label class="s3d-field"><span>环境光强度</span><input type="number" :value="form.ambientIntensity" @input="updateField('ambientIntensity', Number(($event.target as HTMLInputElement).value))" step="0.05" /></label>
          <label class="s3d-field"><span>方向光强度</span><input type="number" :value="form.dirLightIntensity" @input="updateField('dirLightIntensity', Number(($event.target as HTMLInputElement).value))" step="0.05" /></label>
          <label class="s3d-field"><span>方向光 X</span><input type="number" :value="form.dirLightX" @input="updateField('dirLightX', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
          <label class="s3d-field"><span>方向光 Y</span><input type="number" :value="form.dirLightY" @input="updateField('dirLightY', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
          <label class="s3d-field"><span>方向光 Z</span><input type="number" :value="form.dirLightZ" @input="updateField('dirLightZ', Number(($event.target as HTMLInputElement).value))" step="1" /></label>
        </template>

        <!-- ── 网格 ── -->
        <template v-if="sec.id === 'grid'">
          <label class="s3d-field"><span>网格尺寸</span><input type="number" :value="form.gridSize" @input="updateField('gridSize', Number(($event.target as HTMLInputElement).value))" step="100" /></label>
          <label class="s3d-field"><span>分段数</span><input type="number" :value="form.gridDivisions" @input="updateField('gridDivisions', Number(($event.target as HTMLInputElement).value))" step="10" /></label>
          <label class="s3d-field">
            <span>中线颜色</span>
            <input type="color" :value="form.gridColorC" @input="updateField('gridColorC', ($event.target as HTMLInputElement).value)" class="s3d-color" />
            <code class="s3d-hex">{{ form.gridColorC }}</code>
          </label>
          <label class="s3d-field">
            <span>边缘颜色</span>
            <input type="color" :value="form.gridColorE" @input="updateField('gridColorE', ($event.target as HTMLInputElement).value)" class="s3d-color" />
            <code class="s3d-hex">{{ form.gridColorE }}</code>
          </label>
        </template>

        <!-- ── 坐标轴 & 背景 ── -->
        <template v-if="sec.id === 'axes'">
          <label class="s3d-field"><span>坐标轴大小</span><input type="number" :value="form.axesSize" @input="updateField('axesSize', Number(($event.target as HTMLInputElement).value))" step="10" /></label>
          <label class="s3d-field">
            <span>背景色</span>
            <input type="color" :value="form.bgColor" @input="updateField('bgColor', ($event.target as HTMLInputElement).value)" class="s3d-color" />
            <code class="s3d-hex">{{ form.bgColor }}</code>
          </label>
        </template>

      </div>
    </div>
  </div>
</template>

<style scoped>
.scene3d-panel {
  display: flex;
  flex-direction: column;
  color: #d4d4d8;
}
.s3d-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}
.s3d-title { font-size: 14px; font-weight: 600; }
.s3d-reset {
  font-size: 11px;
  padding: 3px 10px;
  background: #27272a;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
}
.s3d-reset:hover { background: #3f3f46; color: #e4e4e7; }

/* ── 可见性开关 ── */
.s3d-toggles {
  display: flex;
  gap: 12px;
  padding: 6px 14px;
  border-bottom: 1px solid #1f1f23;
}
.s3d-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a1a1aa;
  cursor: pointer;
  user-select: none;
}
.s3d-toggle input[type="checkbox"] {
  accent-color: #3b82f6;
  cursor: pointer;
}
.s3d-toggle:hover { color: #e4e4e7; }

/* ── 分类折叠 ── */
.s3d-section { border-bottom: 1px solid #1f1f23; }
.s3d-section-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #71717a;
  background: none;
  border: none;
  cursor: pointer;
}
.s3d-section-btn:hover { color: #a1a1aa; }
.s3d-arrow {
  font-size: 10px;
  transition: transform 0.15s;
  display: inline-block;
}
.s3d-arrow.open { transform: rotate(90deg); }

/* ── 字段 ── */
.s3d-fields { padding: 4px 14px 10px; }
.s3d-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.s3d-field span {
  width: 72px;
  flex-shrink: 0;
  font-size: 12px;
  color: #a1a1aa;
}
.s3d-field input[type="number"] {
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
.s3d-field input[type="number"]:focus { outline: none; border-color: #3b82f6; }
.s3d-color {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
.s3d-hex {
  font-size: 11px;
  color: #52525b;
  font-family: monospace;
}
</style>
