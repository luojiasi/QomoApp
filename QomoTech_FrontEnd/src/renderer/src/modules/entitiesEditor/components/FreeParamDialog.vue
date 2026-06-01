<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFreeParamDialog } from '../composables/useFreeParamDialog'
import { useFreeParamTask } from '../composables/useFreeParamTask'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useNotification } from '@/shared/composables/useNotification'
import { useEditorStore } from '../stores/editorStore'
import { generateId } from '../utils/idgen'
import { drawnEntityIds } from '../composables/useFreeParamTask'
import type { SurfaceEntity, EditorEntity } from '../commons/types'

const { isOpen, open: _open, close } = useFreeParamDialog()
const { taskRows, initDefault, addRow, removeRow, exportToFile, loadFromFile } = useFreeParamTask()
const editorStore = useEditorStore()

const recipeStore = useRecipeSettingsStore()

const activeMainRecipes = computed(() =>
  recipeStore.recipeState.mainRecipes.filter((recipe) => recipe.status === 'active')
)

const { warning } = useNotification()
const fileInputRef = ref<HTMLInputElement | null>(null)

async function open(): Promise<void> {
  await recipeStore.loadRecipeState()
  if (taskRows.length === 0) {
    initDefault()
  }
  _open()
}

defineExpose({ open, close })

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    close()
  }
}

function onSave(): void {
  for (const row of taskRows) {
    if (isDiameterInvalid(row.diameter)) {
      warning(`第 ${row.taskNo} 行直径必须在 0~200 之间，请修正后再保存`)
      return
    }
    if (isHeightInvalid(row.height)) {
      warning(`第 ${row.taskNo} 行高度必须在 0~20 之间，请修正后再保存`)
      return
    }
    if (isDivisionsInvalid(row.divisions)) {
      warning(`第 ${row.taskNo} 行分割数必须为 0 或 3~360，请修正后再保存`)
      return
    }
    if (isRecipeInvalid(row.recipe)) {
      warning(`第 ${row.taskNo} 行未选择配方，请选择后再保存`)
      return
    }
  }
  exportToFile()
}

function onDraw(): void {
  // 校验
  for (const row of taskRows) {
    if (isDiameterInvalid(row.diameter)) {
      warning(`第 ${row.taskNo} 行直径必须在 0~200 之间，请修正后再绘制`)
      return
    }
    if (isHeightInvalid(row.height)) {
      warning(`第 ${row.taskNo} 行高度必须在 0~20 之间，请修正后再绘制`)
      return
    }
    if (isDivisionsInvalid(row.divisions)) {
      warning(`第 ${row.taskNo} 行分割数必须为 0 或 3~360，请修正后再绘制`)
      return
    }
  }

  // 构建新实体列表
  const newEntities: SurfaceEntity<EditorEntity>[] = []
  drawnEntityIds.clear()

  for (const row of taskRows) {
    const radius = row.diameter / 2
    const height = row.height
    const n = row.divisions

    if (n === 0) {
      // 画圆
      const id = generateId()
      newEntities.push({
        id,
        kind: 'CIRCLE',
        layerId: editorStore.activeLayerId,
        openSide: 'LEFT',
        center: { X: 0, Y: 0 },
        radius,
        height,
        openSize: 1,
        tiltAngleDeg: 0
      } as SurfaceEntity<EditorEntity>)
      drawnEntityIds.add(id)
    } else {
      // 计算圆周上的 n 个点
      const points: Array<{ X: number; Y: number }> = []
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n
        points.push({
          X: radius * Math.cos(angle),
          Y: radius * Math.sin(angle)
        })
      }
      // 按顺序连接成直线
      for (let i = 0; i < n; i++) {
        const start = points[i]
        const end = points[(i + 1) % n]
        const id = generateId()
        newEntities.push({
          id,
          kind: 'LINE',
          layerId: editorStore.activeLayerId,
          openSide: 'LEFT',
          start,
          end,
          height,
          openSize: 1,
          tiltAngleDeg: 0
        } as SurfaceEntity<EditorEntity>)
        drawnEntityIds.add(id)
      }
    }
  }

  editorStore.replaceAllEntities(newEntities)
  close()
}

function onImportClick(): void {
  fileInputRef.value?.click()
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    loadFromFile(text)
  }
  reader.readAsText(file)
  input.value = ''
}

function isDivisionsInvalid(divisions: number): boolean {
  return divisions !== 0 && (divisions < 3 || divisions > 360)
}

function isHeightInvalid(height: number): boolean {
  return height < 0 || height > 20
}

function isDiameterInvalid(diameter: number): boolean {
  return diameter < 0 || diameter > 200
}

function isRecipeInvalid(recipe: string): boolean {
  return !recipe
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="freeparam-overlay" tabindex="-1" @keydown="onKeydown">
      <div class="freeparam-dialog">
        <div class="fp-header">
          <span class="fp-title">自由编辑参数</span>
          <button class="fp-close" @click="close">✕</button>
        </div>

        <div class="fp-body">
          <div class="fp-toolbar">
            <button class="fp-btn-sm import" @click="onImportClick">导入</button>
            <button class="fp-btn-sm add" @click="addRow">+ 添加任务</button>
          </div>

          <div class="fp-table-wrap">
            <table class="fp-table">
              <thead>
                <tr>
                  <th class="col-no">序号</th>
                  <th class="col-num">直径 (mm)</th>
                  <th class="col-num">高度 (mm)</th>
                  <th class="col-num">分割数</th>
                  <th class="col-recipe">配方</th>
                  <th class="col-act"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in taskRows" :key="row.id">
                  <td class="col-no muted">{{ row.taskNo }}</td>
                  <td class="col-num">
                    <input
                      v-model.number="row.diameter"
                      type="number"
                      class="fp-input numeric"
                      :class="{ invalid: isDiameterInvalid(row.diameter) }"
                      step="0.01"
                      min="0"
                      :title="isDiameterInvalid(row.diameter) ? '直径必须在 0~200 之间' : ''"
                      max="200"
                    />
                  </td>
                  <td class="col-num">
                    <div class="input-unit">
                      <input
                        v-model.number="row.height"
                        type="number"
                        class="fp-input numeric"
                        :class="{ invalid: isHeightInvalid(row.height) }"
                        min="0"
                        max="20"
                        :title="isHeightInvalid(row.height) ? '高度必须在 0~20 之间' : ''"
                      />
                      <span class="unit">mm</span>
                    </div>
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.divisions"
                      type="number"
                      class="fp-input numeric"
                      :class="{ invalid: isDivisionsInvalid(row.divisions) }"
                      :title="isDivisionsInvalid(row.divisions) ? '值必须为 0 或 3~360' : ''"
                    />
                  </td>
                  <td class="col-recipe">
                    <div class="select-wrap">
                      <select
                        v-model="row.recipe"
                        class="fp-select"
                        :class="{ invalid: isRecipeInvalid(row.recipe) }"
                        :title="isRecipeInvalid(row.recipe) ? '请选择配方' : ''"
                      >
                        <option value="">—</option>
                        <option v-for="r in activeMainRecipes" :key="r.id" :value="r.id">
                          {{ r.name }}
                        </option>
                      </select>
                    </div>
                  </td>
                  <td class="col-act">
                    <button class="fp-row-del" @click="removeRow(row.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            accept=".jjs"
            style="display: none"
            @change="onFileChange"
          />
        </div>

        <div class="fp-footer">
          <button class="fp-btn cancel" @click="close">取消</button>
          <button class="fp-btn save" @click="onSave">保存</button>
          <button class="fp-btn draw" @click="onDraw">绘制</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.freeparam-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.freeparam-dialog {
  width: 720px;
  max-width: 92vw;
  max-height: 80vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: #131316;
  border: 1px solid #27272a;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* ── header ── */
.fp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.fp-title {
  font-size: 15px;
  font-weight: 600;
  color: #e4e4e7;
}
.fp-close {
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
}
.fp-close:hover {
  color: #e4e4e7;
  background: #27272a;
}

/* ── body ── */
.fp-body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px 16px;
  gap: 10px;
}

/* ── toolbar ── */
.fp-toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.fp-btn-sm {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #27272a;
  border-radius: 5px;
  cursor: pointer;
  background: #18181b;
  color: #a1a1aa;
  transition: all 0.15s;
}
.fp-btn-sm:hover {
  background: #27272a;
  color: #e4e4e7;
}
.fp-btn-sm.add {
  color: #3b82f6;
}
.fp-btn-sm.add:hover {
  background: #1e3a5f;
}

/* ── table ── */
.fp-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid #27272a;
  border-radius: 6px;
}
.fp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.fp-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #52525b;
  background: #18181b;
  border-bottom: 2px solid #27272a;
  white-space: nowrap;
}
.fp-table td {
  padding: 4px 6px;
  border-bottom: 1px solid #1e1e24;
  vertical-align: middle;
}
.fp-table tr:last-child td {
  border-bottom: none;
}
.fp-table tr:hover td {
  background: #1a1a20;
}

.col-no {
  width: 48px;
}
.col-num {
  width: 120px;
}
.col-recipe {
  width: 140px;
}
.col-act {
  width: 36px;
  text-align: center;
}
.muted {
  color: #52525b;
}

/* ── inputs ── */
.fp-input {
  width: 100%;
  padding: 5px 8px;
  font-size: 13px;
  font-family: inherit;
  color: #d4d4d8;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.15s;
}
.fp-input:focus {
  border-color: #3b82f6;
}
.fp-input.numeric {
  text-align: left;
  -moz-appearance: textfield;
}
.fp-input.numeric::-webkit-outer-spin-button,
.fp-input.numeric::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.fp-input.invalid,
.fp-select.invalid {
  border-color: #ef4444;
}

.input-unit {
  display: flex;
  align-items: center;
  gap: 2px;
}
.input-unit .fp-input {
  flex: 1;
}
.unit {
  font-size: 12px;
  color: #52525b;
  flex-shrink: 0;
}

/* ── select ── */
.select-wrap {
  position: relative;
}
.select-wrap::after {
  content: '▾';
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 10px;
  color: #52525b;
}
.fp-select {
  width: 100%;
  padding: 5px 22px 5px 8px;
  font-size: 13px;
  font-family: inherit;
  color: #d4d4d8;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 4px;
  outline: none;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.fp-select:focus {
  border-color: #3b82f6;
}

/* ── row delete ── */
.fp-row-del {
  background: none;
  border: none;
  color: #52525b;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
}
.fp-table tr:hover .fp-row-del {
  opacity: 1;
}
.fp-row-del:hover {
  color: #ef4444;
  background: #1e1e24;
}

/* ── footer ── */
.fp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}
.fp-btn {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.fp-btn.cancel {
  background: #ef4444;
  color: #fff;
}
.fp-btn.cancel:hover {
  background: #dc2626;
}
.fp-btn.save {
  background: #22c55e;
  color: #fff;
}
.fp-btn.save:hover {
  background: #16a34a;
}
.fp-btn.draw {
  background: #e4e4e7;
  color: #18181b;
}
.fp-btn.draw:hover {
  background: #f4f4f5;
}

/* ── modal transition ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .freeparam-dialog,
.modal-leave-active .freeparam-dialog {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .freeparam-dialog {
  transform: scale(0.95) translateY(8px);
}
.modal-leave-to .freeparam-dialog {
  transform: scale(0.95) translateY(8px);
}
</style>
