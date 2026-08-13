<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFreeParamDialog } from '../composables/useFreeParamDialog'
import { useFreeParamTask } from '../composables/useFreeParamTask'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useNotification } from '@/shared/composables/useNotification'
import { sendFreeParams } from '@/modules/program/api'
import { useEditorStore } from '../stores/editorStore'
import { generateId } from '../utils/idgen'
import { drawnEntityIds } from '../composables/useFreeParamTask'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'
import type { SurfaceEntity, EditorEntity } from '../commons/types'

const { isOpen, open: _open, close } = useFreeParamDialog()
const { taskRows, initDefault, addRow, removeRow, exportToFile, loadFromFile } = useFreeParamTask()
const editorStore = useEditorStore()

const recipeStore = useRecipeSettingsStore()

const {
  programRunning,
  programPaused,
  programTaskCount,
} = useProgramRunner()

const { warning, success, error } = useNotification()
const fileInputRef = ref<HTMLInputElement | null>(null)
const sendConfirming = ref(false)
const riskConfirmed = ref(false)
const riskShake = ref(false)
const rRotationInterval = ref(0)
const rCompensationValue = ref(0)

const activeMainRecipes = computed(() =>
  recipeStore.recipeState.mainRecipes.filter((recipe) => recipe.status === 'active')
)

async function open(): Promise<void> {
  await recipeStore.loadRecipeState()
  if (taskRows.length === 0) {
    initDefault()
  }
  sendConfirming.value = false
  riskConfirmed.value = false
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
    if (isAngleInvalid(row.angle)) {
      warning(`第 ${row.taskNo} 行角度必须在 -90~90 之间，请修正后再保存`)
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

async function onSendToBackend(): Promise<void> {
  if (!sendConfirming.value) {
    if (taskRows.length === 0) {
      warning('没有可发送的参数，请先添加任务行')
      return
    }
    for (const row of taskRows) {
      if (isDiameterInvalid(row.diameter)) {
        warning(`第 ${row.taskNo} 行直径必须在 0~200 之间，请修正后再发送`)
        return
      }
      if (isAngleInvalid(row.angle)) {
        warning(`第 ${row.taskNo} 行角度必须在 -90~90 之间，请修正后再发送`)
        return
      }
      if (isHeightInvalid(row.height)) {
        warning(`第 ${row.taskNo} 行高度必须在 0~20 之间，请修正后再发送`)
        return
      }
      if (isDivisionsInvalid(row.divisions)) {
        warning(`第 ${row.taskNo} 行分割数必须为 0 或 3~360，请修正后再发送`)
        return
      }
      if (isRecipeInvalid(row.recipe)) {
        warning(`第 ${row.taskNo} 行未选择配方，请选择后再发送`)
        return
      }
    }
    sendConfirming.value = true
    return
  }

  if (!riskConfirmed.value) {
    riskShake.value = true
    setTimeout(() => { riskShake.value = false }, 600)
    return
  }

  sendConfirming.value = false
  riskConfirmed.value = false

  const {
    mainRecipes,
    machiningRecipes,
    blackeningRecipes,
    laserPowerRecipes,
    horizontalFormulaRecipes,
    verticalFormulaRecipes,
  } = recipeStore.recipeState

  function resolveRecipeChain(mainRecipeId: string) {
    const main = mainRecipes.find(r => r.id === mainRecipeId)
    if (!main) return null
    const machining = machiningRecipes.find(r => r.id === main.machiningRecipeId)
    const blackening = blackeningRecipes.find(r => r.id === main.blackeningRecipeId)
    const vertical = machining ? verticalFormulaRecipes.find(r => r.id === machining.verticalFormulaId) : undefined
    const horizontal = machining ? horizontalFormulaRecipes.find(r => r.id === machining.horizontalFormulaId) : undefined
    const machiningLaser = machining ? laserPowerRecipes.find(r => r.id === machining.laserPowerRecipeId) : undefined
    const blackeningLaser = blackening ? laserPowerRecipes.find(r => r.id === blackening.laserPowerRecipeId) : undefined
    return {
      vertical: vertical ?? null,
      horizontal: horizontal ?? null,
      blackening: blackening ?? null,
      machiningLaser: machiningLaser ?? null,
      blackeningLaser: blackeningLaser ?? null,
    }
  }

  const payload = {
    recipes: {
      mainRecipes,
      machiningRecipes,
      blackeningRecipes,
      laserPowerRecipes,
      horizontalFormulaRecipes,
      verticalFormulaRecipes,
    },
    rows: taskRows.map(row => ({
      taskNo: row.taskNo,
      diameter: row.diameter,
      angle: row.angle,
      height: row.height,
      divisions: row.divisions,
      recipeId: row.recipe,
      recipe: resolveRecipeChain(row.recipe),
      compX: row.compX,
      compY: row.compY,
      compZ: row.compZ,
      compAngle: row.compAngle,
      chordRatio: row.chordRatio,
      k: row.k,
      b: row.b,
      rInterval: rRotationInterval.value,
      rCompensation: rCompensationValue.value,
    })),
  }

  try {
    const result = await sendFreeParams(payload as unknown as Record<string, unknown>)
    if (result?.success) {
      const data = result?.data as { task_count?: number } | undefined
      const tc = typeof data?.task_count === 'number' ? data.task_count : 0
      programTaskCount.value = tc
      programRunning.value = true
      programPaused.value = false
      localStorage.setItem('qomo.startProgram.startedAtMs', String(Date.now()))
      success(result?.message || '自由编辑参数已发送至后端')
    } else {
      error(result?.message || '发送失败：后端未提供失败原因')
    }
  } catch {
    error('发送失败：无法连接后端')
  }
}

function onDraw(): void {
  // 校验
  for (const row of taskRows) {
    if (isDiameterInvalid(row.diameter)) {
      warning(`第 ${row.taskNo} 行直径必须在 0~200 之间，请修正后再绘制`)
      return
    }
    if (isAngleInvalid(row.angle)) {
      warning(`第 ${row.taskNo} 行角度必须在 -90~90 之间，请修正后再绘制`)
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

  // 预计算每层的 zBase（自顶向下）
  // taskRows[0]=最上层，从总高度开始向下
  const totalHeight = taskRows.reduce((sum, r) => sum + r.height, 0)
  const rowZBase: number[] = new Array(taskRows.length)
  let zTop = totalHeight
  for (let i = 0; i < taskRows.length; i++) {
    rowZBase[i] = zTop
    zTop -= taskRows[i].height
  }

  const newEntities: SurfaceEntity<EditorEntity>[] = []
  drawnEntityIds.clear()

  // 从上到下遍历：taskRows[0] = 序号1 = 最上层
  for (let i = 0; i < taskRows.length; i++) {
    const row = taskRows[i]
    const n = row.divisions === 0 ? 360 : row.divisions
    const radius = row.diameter / 2

    // 倾斜角：angle=0 表示水平（垂直壁），angle 增大表示向内侧倾斜
    const tiltAngleDeg = 90 -row.angle

    // 计算圆周上的 n 个顶点
    const points: Array<{ X: number; Y: number }> = []
    for (let j = 0; j < n; j++) {
      const angle = -(2 * Math.PI * j) / n
      points.push({
        X: Math.round(radius * Math.cos(angle) * 1000) / 1000,
        Y: Math.round(radius * Math.sin(angle) * 1000) / 1000
      })
    }

    // 生成 LINE 实体
    for (let j = 0; j < n; j++) {
      const id = generateId()
      newEntities.push({
        id,
        kind: 'LINE',
        layerId: editorStore.activeLayerId,
        openSide: 'LEFT',
        start: points[j],
        end: points[(j + 1) % n],
        height: row.height,
        zBase: rowZBase[i],
        openSize: 0.1,
        tiltAngleDeg
      } as SurfaceEntity<EditorEntity>)
      drawnEntityIds.add(id)
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

function isAngleInvalid(angle: number): boolean {
  return angle < -90 || angle > 90
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
            <div class="fp-toolbar-left">
              <button class="fp-btn-sm import" @click="onImportClick">导入</button>
              <button class="fp-btn-sm add" @click="addRow">+ 添加任务</button>
            </div>
            <div class="fp-toolbar-right">
              <span class="fp-toolbar-label">每旋转</span>
              <input
                v-model.number="rRotationInterval"
                type="number"
                class="fp-input-sm"
                step="1"
                min="0"
              />
              <span class="fp-toolbar-label">圈补偿</span>
              <input
                v-model.number="rCompensationValue"
                type="number"
                class="fp-input-sm"
                step="0.001"
              />
              <span class="fp-toolbar-label fp-toolbar-unit">mm</span>
            </div>
          </div>

          <div class="fp-table-wrap">
            <table class="fp-table">
              <thead>
                <tr>
                  <th class="col-no">序号</th>
                  <th class="col-num">直径 (mm)</th>
                  <th class="col-num">角度 (°)</th>
                  <th class="col-num">角度补偿</th>
                  <th class="col-num">高度 (mm)</th>
                  <th class="col-num">分割数</th>
                  <th class="col-num">X补偿</th>
                  <th class="col-num">Y补偿</th>
                  <th class="col-num">Z补偿</th>
                  <th class="col-num">弦长倍率</th>
                  <th class="col-num">K</th>
                  <th class="col-num">B</th>
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
                    <input
                      v-model.number="row.angle"
                      type="number"
                      class="fp-input numeric"
                      :class="{ invalid: isAngleInvalid(row.angle) }"
                      step="0.1"
                      min="-90"
                      max="90"
                      :title="isAngleInvalid(row.angle) ? '角度必须在 -90~90 之间' : ''"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.compAngle"
                      type="number"
                      class="fp-input numeric"
                      step="0.01"
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
                  <td class="col-num">
                    <input
                      v-model.number="row.compX"
                      type="number"
                      class="fp-input numeric"
                      step="0.001"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.compY"
                      type="number"
                      class="fp-input numeric"
                      step="0.001"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.compZ"
                      type="number"
                      class="fp-input numeric"
                      step="0.001"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.chordRatio"
                      type="number"
                      class="fp-input numeric"
                      step="0.1"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.k"
                      type="number"
                      class="fp-input numeric"
                      step="0.001"
                      title="线性系数 K"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      v-model.number="row.b"
                      type="number"
                      class="fp-input numeric"
                      step="0.001"
                      title="线性系数 B"
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
          <button
            class="fp-btn send"
            :class="{ confirming: sendConfirming, disabled: sendConfirming && !riskConfirmed }"
            @click="onSendToBackend"
          >
            {{ sendConfirming ? '确定使用自由编辑参数进行切割' : '使用自由编辑参数进行切割' }}
          </button>
          <div
            v-if="sendConfirming"
            class="fp-risk"
            :class="{ unconfirmed: !riskConfirmed }"
          >
            <label class="fp-risk-label">
              <input
                v-model="riskConfirmed"
                type="checkbox"
                class="fp-risk-check"
                :class="{ shake: riskShake }"
              />
              <span class="fp-risk-text">已确认不存在加工风险</span>
            </label>
          </div>
          <div class="fp-footer-spacer" />
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
  width: 1200px;
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.fp-toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
}
.fp-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid #27272a;
  border-radius: 6px;
  background: #09090b;
}
.fp-toolbar-label {
  font-size: 11px;
  color: #52525b;
  user-select: none;
}
.fp-toolbar-unit {
  margin-left: 2px;
  color: #3b82f6;
  font-weight: 500;
}
.fp-input-sm {
  width: 56px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: inherit;
  color: #d4d4d8;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 4px;
  outline: none;
  text-align: center;
  transition: border-color 0.15s;
}
.fp-input-sm:focus {
  border-color: #3b82f6;
}
.fp-input-sm::-webkit-outer-spin-button,
.fp-input-sm::-webkit-inner-spin-button {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
}
.fp-input-sm {
  appearance: textfield;
  -moz-appearance: textfield;
  -webkit-appearance: textfield;
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
  appearance: textfield;
  -moz-appearance: textfield;
  -webkit-appearance: textfield;
}
.fp-input.numeric::-webkit-outer-spin-button,
.fp-input.numeric::-webkit-inner-spin-button {
  appearance: none;
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
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}
.fp-footer-spacer {
  flex: 1;
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
.fp-btn.send {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  border: none;
}
.fp-btn.send:hover {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
}
.fp-btn.send.confirming {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  animation: send-pulse 0.8s ease-in-out;
}
.fp-btn.send.confirming:hover {
  background: linear-gradient(135deg, #d97706, #dc2626);
}

@keyframes send-pulse {
  0%   { transform: scale(1);   box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
  15%  { transform: scale(1.06); }
  30%  { transform: scale(0.97); }
  45%  { transform: scale(1.03); }
  60%  { transform: scale(0.99); }
  75%  { transform: scale(1.01); }
  100% { transform: scale(1);   box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}

/* ── risk checkbox ── */
.fp-risk {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid #27272a;
  border-radius: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.fp-risk.unconfirmed {
  border-color: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.35);
  animation: risk-glow 1.2s ease-in-out infinite;
}
.fp-risk-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.fp-risk-check {
  width: 16px;
  height: 16px;
  accent-color: #f59e0b;
  cursor: pointer;
  flex-shrink: 0;
}
.fp-risk-text {
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.4;
}
.fp-risk.unconfirmed .fp-risk-text {
  color: #f59e0b;
  font-weight: 500;
}

@keyframes risk-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.25); }
  50%      { box-shadow: 0 0 14px rgba(245, 158, 11, 0.55); }
}

.fp-risk-check.shake {
  animation: risk-shake 0.5s ease-in-out;
}

@keyframes risk-shake {
  0%, 100% { transform: translateX(0); }
  10%      { transform: translateX(-6px); }
  20%      { transform: translateX(6px); }
  30%      { transform: translateX(-5px); }
  40%      { transform: translateX(5px); }
  50%      { transform: translateX(-3px); }
  60%      { transform: translateX(3px); }
  70%      { transform: translateX(-1px); }
  80%      { transform: translateX(1px); }
}

.fp-btn.send.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
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


