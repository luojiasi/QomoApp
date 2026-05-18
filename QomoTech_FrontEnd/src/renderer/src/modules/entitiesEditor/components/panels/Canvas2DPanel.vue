<script setup lang="ts">
import { ref } from 'vue'
import type { Canvas2DForm } from '../../composables/canvas/useCanvas2DSettings'

const props = defineProps<{
  form: Canvas2DForm
}>()

const emit = defineEmits<{
  'update:form': [patch: Partial<Canvas2DForm>]
  'reset': []
}>()

function updateField<K extends keyof Canvas2DForm>(key: K, value: Canvas2DForm[K]) {
  emit('update:form', { [key]: value } as Partial<Canvas2DForm>)
}

type Section = 'grid' | 'entity' | 'select' | 'preview' | 'hit'

const expanded = ref<Record<Section, boolean>>({
  grid: false,
  entity: false,
  select: false,
  preview: false,
  hit: false,
})

function toggle(s: Section) { expanded.value[s] = !expanded.value[s] }

const sections: { id: Section; label: string }[] = [
  { id: 'grid', label: '网格' },
  { id: 'entity', label: '实体绘制' },
  { id: 'select', label: '选择 & 悬停' },
  { id: 'preview', label: '预览 & 框选' },
  { id: 'hit', label: '命中检测' },
]
</script>

<template>
  <div class="c2d-panel">
    <div class="c2d-header">
      <span class="c2d-title">2D 画布参数</span>
      <button class="c2d-reset" @click="emit('reset')">恢复默认</button>
    </div>

    <div v-for="sec in sections" :key="sec.id" class="c2d-section">
      <button class="c2d-section-btn" @click="toggle(sec.id)">
        <span class="c2d-arrow" :class="{ open: expanded[sec.id] }">▸</span>
        <span>{{ sec.label }}</span>
      </button>

      <div v-show="expanded[sec.id]" class="c2d-fields">

        <!-- ── 网格 ── -->
        <template v-if="sec.id === 'grid'">
          <label class="c2d-field"><span>吸附网格</span>
            <input type="checkbox" :checked="form.snaptoGrid"
              @change="updateField('snaptoGrid', ($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="c2d-field"><span>网格步长</span><input type="number" :value="form.gridStep" @input="updateField('gridStep', Number(($event.target as HTMLInputElement).value))" min="1" step="1" /></label>
          <label class="c2d-field">
            <span>网格颜色</span>
            <input type="color" :value="form.gridColor" @input="updateField('gridColor', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.gridColor }}</code>
          </label>
          <label class="c2d-field">
            <span>轴线颜色</span>
            <input type="color" :value="form.gridAxisColor" @input="updateField('gridAxisColor', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.gridAxisColor }}</code>
          </label>
          <label class="c2d-field"><span>轴线宽度</span><input type="number" :value="form.axisLineWidth" @input="updateField('axisLineWidth', Number(($event.target as HTMLInputElement).value))" min="0.5" step="0.5" /></label>
        </template>

        <!-- ── 实体绘制 ── -->
        <template v-if="sec.id === 'entity'">
          <label class="c2d-field">
            <span>实体颜色</span>
            <input type="color" :value="form.entityStroke" @input="updateField('entityStroke', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.entityStroke }}</code>
          </label>
          <label class="c2d-field"><span>实体线宽</span><input type="number" :value="form.entityLineWidth" @input="updateField('entityLineWidth', Number(($event.target as HTMLInputElement).value))" min="0.5" step="0.5" /></label>
        </template>

        <!-- ── 选择 & 悬停 ── -->
        <template v-if="sec.id === 'select'">
          <label class="c2d-field">
            <span>选中颜色</span>
            <input type="color" :value="form.selectionStroke" @input="updateField('selectionStroke', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.selectionStroke }}</code>
          </label>
          <label class="c2d-field"><span>选中线宽</span><input type="number" :value="form.selectionLineWidth" @input="updateField('selectionLineWidth', Number(($event.target as HTMLInputElement).value))" min="0.5" step="0.5" /></label>
          <label class="c2d-field">
            <span>悬停颜色</span>
            <input type="color" :value="form.hoverStroke" @input="updateField('hoverStroke', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.hoverStroke }}</code>
          </label>
        </template>

        <!-- ── 预览 & 框选 ── -->
        <template v-if="sec.id === 'preview'">
          <label class="c2d-field">
            <span>预览颜色</span>
            <input type="color" :value="form.previewStroke" @input="updateField('previewStroke', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.previewStroke }}</code>
          </label>
          <label class="c2d-field"><span>预览虚线</span><input type="text" :value="form.previewDash" @input="updateField('previewDash', ($event.target as HTMLInputElement).value)" placeholder="6, 4" /></label>
          <label class="c2d-field">
            <span>框选颜色</span>
            <input type="color" :value="form.selectionRectStroke" @input="updateField('selectionRectStroke', ($event.target as HTMLInputElement).value)" class="c2d-color" />
            <code class="c2d-hex">{{ form.selectionRectStroke }}</code>
          </label>
          <label class="c2d-field"><span>框选虚线</span><input type="text" :value="form.selectionRectDash" @input="updateField('selectionRectDash', ($event.target as HTMLInputElement).value)" placeholder="6, 4" /></label>
          <label class="c2d-field"><span>框选填充</span><input type="text" :value="form.selectionRectFill" @input="updateField('selectionRectFill', ($event.target as HTMLInputElement).value)" placeholder="rgba(59,130,246,0.08)" /></label>
        </template>

        <!-- ── 命中检测 ── -->
        <template v-if="sec.id === 'hit'">
          <label class="c2d-field"><span>命中阈值(px)</span><input type="number" :value="form.hitPx" @input="updateField('hitPx', Number(($event.target as HTMLInputElement).value))" min="4" max="40" step="1" /></label>
        </template>

      </div>
    </div>
  </div>
</template>

<style scoped>
.c2d-panel {
  display: flex;
  flex-direction: column;
  color: #d4d4d8;
}
.c2d-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}
.c2d-title { font-size: 14px; font-weight: 600; }
.c2d-reset {
  font-size: 11px;
  padding: 3px 10px;
  background: #27272a;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
}
.c2d-reset:hover { background: #3f3f46; color: #e4e4e7; }

.c2d-section { border-bottom: 1px solid #1f1f23; }
.c2d-section-btn {
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
.c2d-section-btn:hover { color: #a1a1aa; }
.c2d-arrow {
  font-size: 10px;
  transition: transform 0.15s;
  display: inline-block;
}
.c2d-arrow.open { transform: rotate(90deg); }

.c2d-fields { padding: 4px 14px 10px; }
.c2d-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.c2d-field span {
  width: 72px;
  flex-shrink: 0;
  font-size: 12px;
  color: #a1a1aa;
}
.c2d-field input[type="number"],
.c2d-field input[type="text"] {
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
.c2d-field input:focus { outline: none; border-color: #3b82f6; }
.c2d-color {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
.c2d-hex {
  font-size: 11px;
  color: #52525b;
  font-family: monospace;
}
</style>
