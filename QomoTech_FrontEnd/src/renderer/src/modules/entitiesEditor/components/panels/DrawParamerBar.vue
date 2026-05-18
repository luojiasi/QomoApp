<script setup lang="ts">
import { useDrawParamerBar } from '../../composables/canvas/useDrawParamerBar'

const {
  pointX,
  pointY,
  isActive,
  kindName,
  activeFieldDef,
  multiPoints,
  bulges,
  canComplete,
  toggleValue,
  toggleToggle,
  completePoint,
  addPoint,
  updateBulge,
  complete,
  undo,
  cancel,
} = useDrawParamerBar()
</script>

<template>
  <div v-if="isActive" class="param-bar">
    <!-- 标签行 -->
    <div class="param-header">
      <span class="param-kind">{{ kindName }}</span>
      <span v-if="activeFieldDef" class="param-field-label">
        — {{ activeFieldDef.label }}
      </span>
    </div>

    <!-- ── point 字段 ── -->
    <template v-if="activeFieldDef?.kind === 'point'">
      <div class="param-coord-row">
        <label class="param-coord">
          <span>X</span>
          <input type="number" :value="pointX" step="0.1"
            @input="pointX = +($event.target as HTMLInputElement).value" />
        </label>
        <label class="param-coord">
          <span>Y</span>
          <input type="number" :value="pointY" step="0.1"
            @input="pointY = +($event.target as HTMLInputElement).value" />
        </label>
      </div>
    </template>

    <!-- ── multiPoint 字段 ── -->
    <template v-else-if="activeFieldDef?.kind === 'multiPoint'">
      <ul v-if="multiPoints.length > 0" class="param-points">
        <li v-for="(p, i) in multiPoints" :key="i" class="param-point-item">
          <span class="param-point-idx">{{ i + 1 }}</span>
          <span class="param-point-val">{{ p.X.toFixed(1) }}, {{ p.Y.toFixed(1) }}</span>
          <label class="param-bulge">
            <span>凸</span>
            <input type="number" :value="bulges[i] ?? 0" step="0.01"
              @input="updateBulge(i, +($event.target as HTMLInputElement).value)" />
          </label>
        </li>
      </ul>

      <div class="param-coord-row">
        <label class="param-coord">
          <span>X</span>
          <input type="number" :value="pointX" step="0.1"
            @input="pointX = +($event.target as HTMLInputElement).value" />
        </label>
        <label class="param-coord">
          <span>Y</span>
          <input type="number" :value="pointY" step="0.1"
            @input="pointY = +($event.target as HTMLInputElement).value" />
        </label>
      </div>
      <div class="param-actions">
        <button class="param-btn" @click="addPoint">添加</button>
      </div>
    </template>

    <!-- ── toggle 字段 ── -->
    <template v-else-if="activeFieldDef?.kind === 'toggle'">
      <label class="param-toggle-row">
        <input type="checkbox" :checked="toggleValue" @change="toggleToggle" />
        <span>{{ activeFieldDef.label }}</span>
      </label>
    </template>

    <!-- ── number 字段 ── -->
    <template v-else-if="activeFieldDef?.kind === 'number'">
      <div class="param-inputs">
        <input
          type="number"
          :value="pointX"
          :step="1"
          class="param-number-input"
          @input="pointX = +($event.target as HTMLInputElement).value"
        />
      </div>
    </template>

    <!-- ── 全局操作 ── -->
    <div class="param-global">
      <button
        v-if="activeFieldDef?.kind === 'point'"
        class="param-btn param-btn-primary"
        @click="completePoint"
      >完成</button>
      <button
        v-else
        class="param-btn param-btn-primary"
        @click="complete"
      >完成</button>
      <button class="param-btn param-btn-ghost" @click="undo">撤销</button>
      <button class="param-btn param-btn-ghost" @click="cancel">取消</button>
    </div>
  </div>
</template>

<style scoped>
.param-bar {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  min-width: 260px;
  background: rgba(9, 9, 11, 0.92);
  border: 1px solid #27272a;
  border-radius: 8px;
  backdrop-filter: blur(6px);
  pointer-events: auto;
}

.param-header {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid #1f1f23;
}

.param-kind {
  font-size: 13px;
  font-weight: 600;
  color: #d4d4d8;
}

.param-field-label {
  font-size: 11px;
  color: #71717a;
}

/* ── 坐标输入 ── */
.param-coord-row {
  display: flex;
  gap: 6px;
}
.param-coord {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 4px;
}
.param-coord span {
  font-size: 11px;
  color: #71717a;
  width: 14px;
  text-align: right;
}
.param-coord input {
  flex: 1;
  width: 0;
  padding: 4px 6px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: right;
  outline: none;
}
.param-coord input:focus { border-color: #3b82f6; }

.param-number-input {
  width: 100%;
  padding: 5px 8px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: left;
  outline: none;
}
.param-number-input:focus { border-color: #3b82f6; }

/* ── 顶点列表 ── */
.param-points {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 96px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.param-point-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  background: #18181b;
  border-radius: 3px;
  font-size: 11px;
}

.param-point-idx {
  color: #52525b;
  font-size: 10px;
}

.param-point-val {
  color: #a1a1aa;
}
.param-bulge {
  display: flex;
  align-items: center;
  gap: 2px;
}
.param-bulge span {
  font-size: 9px;
  color: #52525b;
}
.param-bulge input {
  width: 40px;
  padding: 1px 3px;
  font-size: 10px;
  background: #0f1117;
  border: 1px solid #3f3f46;
  border-radius: 2px;
  color: #a1a1aa;
  text-align: right;
  outline: none;
}
.param-bulge input:focus { border-color: #3b82f6; }

/* ── toggle ── */
.param-toggle-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a1a1aa;
  cursor: pointer;
}
.param-toggle-row input[type="checkbox"] {
  accent-color: #3b82f6;
}

/* ── 按钮 ── */
.param-actions {
  display: flex;
  gap: 6px;
}

.param-global {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid #1f1f23;
}

.param-btn {
  padding: 3px 12px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
}

.param-btn:hover {
  background: #27272a;
  color: #d4d4d8;
}

.param-btn-primary {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  color: #60a5fa;
}

.param-btn-primary:hover {
  background: rgba(59, 130, 246, 0.25);
  color: #93bbfd;
}

.param-btn-ghost {
  background: none;
  border-color: transparent;
  font-size: 11px;
  padding: 2px 6px;
}

.param-btn-ghost:hover {
  background: #1f1f23;
  color: #d4d4d8;
}
</style>
