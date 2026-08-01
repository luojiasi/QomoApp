<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useL10n } from '../shared/l10n'
import { useRecipes } from '../shared/recipe'
import type { MainRecipe } from '../shared/recipe'
import { startHardwareMonitor, useHardwareState } from '../shared/motion'
import {
  useFreeParamTask,
  isDiameterInvalid,
  isAngleInvalid,
  isHeightInvalid,
  isDivisionsInvalid,
  isRecipeInvalid
} from '../shared/freeparam'

type WorkMode = 'freeParam' | 'drawImage'

const { t } = useL10n()
const { state, load } = useRecipes()
const { mposition } = useHardwareState()
const {
  targets,
  activeTargetId,
  activeTarget,
  taskRows,
  initDefault,
  addTarget,
  selectTarget,
  renameTarget,
  removeTarget,
  addRow,
  removeRow,
  exportToFile,
  loadFromFile
} = useFreeParamTask()

const workMode = ref<WorkMode>('freeParam')
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const statusMsg = ref('')

const activeMainRecipes = computed(() => {
  const list = (state.value.mainRecipes ?? []) as MainRecipe[]
  return list.filter((r) => r.status === 'active')
})

function recipeLabel(r: MainRecipe): string {
  return (r.name && r.name.trim()) || r.id
}

function formatAxis(val: number | undefined | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return val.toFixed(3)
}

/** 读取当前机床 XY，写入当前目标 */
function capturePointXy(): void {
  const target = activeTarget.value
  if (!target) return
  const x = formatAxis(mposition.value['X'])
  const y = formatAxis(mposition.value['Y'])
  target.pointXy = `(${x},${y})`
}

function handleAddTarget(): void {
  const name = `${t('freeParam.targetPrefix')} ${targets.length + 1}`
  const target = addTarget(name)
  void startRename(target.id, target.name)
}

async function startRename(id: string, currentName: string): Promise<void> {
  renamingId.value = id
  renameDraft.value = currentName
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function commitRename(): void {
  const id = renamingId.value
  if (!id) return
  renameTarget(id, renameDraft.value || t('freeParam.targetUntitled'))
  renamingId.value = null
  renameDraft.value = ''
}

function cancelRename(): void {
  renamingId.value = null
  renameDraft.value = ''
}

function setStatus(msg: string): void {
  statusMsg.value = msg
}

/** 保存前校验全部目标的全部行（对齐 FrontEnd FreeParamDialog） */
function validateAllTargets(): string | null {
  for (const target of targets) {
    for (const row of target.rows) {
      const at = `${target.name} #${row.taskNo}`
      if (isDiameterInvalid(row.diameter)) {
        return `${at}: ${t('freeParam.errDiameter')}`
      }
      if (isAngleInvalid(row.angle)) {
        return `${at}: ${t('freeParam.errAngle')}`
      }
      if (isHeightInvalid(row.height)) {
        return `${at}: ${t('freeParam.errHeight')}`
      }
      if (isDivisionsInvalid(row.divisions)) {
        return `${at}: ${t('freeParam.errDivisions')}`
      }
      if (isRecipeInvalid(row.recipe)) {
        return `${at}: ${t('freeParam.errRecipe')}`
      }
    }
  }
  return null
}

function onSave(): void {
  const err = validateAllTargets()
  if (err) {
    setStatus(err)
    return
  }
  exportToFile()
  setStatus(t('freeParam.saveOk'))
}

function onLoadClick(): void {
  fileInputRef.value?.click()
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const ok = loadFromFile(text)
    setStatus(ok ? t('freeParam.loadOk') : t('freeParam.loadFail'))
  }
  reader.onerror = () => {
    setStatus(t('freeParam.loadFail'))
  }
  reader.readAsText(file)
  input.value = ''
}

onMounted(async () => {
  startHardwareMonitor()
  await load()
  initDefault(t('freeParam.targetDefault'))
})
</script>

<template>
  <div class="fp-page">
    <header class="fp-top">
      <div class="fp-top-text">
        <h1 class="fp-title">{{ t('freeParam.title') }}</h1>
        <p class="fp-sub">{{ t('freeParam.subtitle') }}</p>
      </div>
      <div class="fp-mode" role="tablist" :aria-label="t('freeParam.modeLabel')">
        <button
          type="button"
          class="fp-mode-btn"
          role="tab"
          :class="{ active: workMode === 'freeParam' }"
          :aria-selected="workMode === 'freeParam'"
          @click="workMode = 'freeParam'"
        >
          <span class="material-symbols-outlined">tune</span>
          {{ t('freeParam.modeFreeParam') }}
        </button>
        <button
          type="button"
          class="fp-mode-btn"
          role="tab"
          :class="{ active: workMode === 'drawImage' }"
          :aria-selected="workMode === 'drawImage'"
          @click="workMode = 'drawImage'"
        >
          <span class="material-symbols-outlined">draw</span>
          {{ t('freeParam.modeDrawImage') }}
        </button>
      </div>
    </header>

    <div v-if="workMode === 'freeParam'" class="fp-body">
      <aside class="fp-targets">
        <div class="fp-targets-head">
          <div class="fp-panel-label">
            <span class="material-symbols-outlined">flag</span>
            {{ t('freeParam.targetsTitle') }}
          </div>
          <button type="button" class="fp-targets-add" @click="handleAddTarget">
            <span class="material-symbols-outlined">add</span>
            {{ t('freeParam.addTarget') }}
          </button>
        </div>
        <div class="fp-targets-list">
          <div
            v-for="(target, index) in targets"
            :key="target.id"
            class="fp-target-item"
            :class="{ active: target.id === activeTargetId }"
            @click="selectTarget(target.id)"
          >
            <template v-if="renamingId === target.id">
              <input
                ref="renameInputRef"
                v-model="renameDraft"
                class="fp-target-rename"
                @click.stop
                @keydown.enter.prevent="commitRename"
                @keydown.esc.prevent="cancelRename"
                @blur="commitRename"
              />
            </template>
            <template v-else>
              <button
                type="button"
                class="fp-target-main"
                @dblclick.stop="startRename(target.id, target.name)"
              >
                <span class="fp-target-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="fp-target-text">
                  <span class="fp-target-name">{{ target.name }}</span>
                  <span class="fp-target-meta">
                    {{ target.rows.length }} {{ t('freeParam.rowsUnit') }}
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="fp-target-del"
                :disabled="targets.length <= 1"
                :title="t('freeParam.deleteTarget')"
                @click.stop="removeTarget(target.id)"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>
            </template>
          </div>
        </div>
      </aside>

      <div class="fp-workspace">
        <div class="fp-workspace-head">
          <div class="fp-toolbar-left">
            <span class="fp-workspace-kicker">
              <span class="material-symbols-outlined">edit_note</span>
              {{ t('freeParam.workspaceTitle') }}
            </span>
            <span class="fp-active-name">{{ activeTarget?.name ?? '—' }}</span>
            <span class="fp-active-hint">{{ t('freeParam.renameHint') }}</span>
          </div>
          <button type="button" class="fp-add" :disabled="!activeTarget" @click="addRow">
            <span class="material-symbols-outlined">add</span>
            {{ t('freeParam.addTask') }}
          </button>
        </div>

        <div class="fp-workspace-body">
          <section class="fp-main">
            <div class="fp-table-wrap">
              <table class="fp-table">
                <thead>
                  <tr>
                    <th class="col-no">{{ t('freeParam.colNo') }}</th>
                    <th class="col-num">{{ t('freeParam.colDiameter') }}</th>
                    <th class="col-num">{{ t('freeParam.colAngle') }}</th>
                    <th class="col-num">{{ t('freeParam.colCompAngle') }}</th>
                    <th class="col-num">{{ t('freeParam.colHeight') }}</th>
                    <th class="col-num">{{ t('freeParam.colDivisions') }}</th>
                    <th class="col-num">{{ t('freeParam.colCompX') }}</th>
                    <th class="col-num">{{ t('freeParam.colCompY') }}</th>
                    <th class="col-num">{{ t('freeParam.colCompZ') }}</th>
                    <th class="col-num">{{ t('freeParam.colChordRatio') }}</th>
                    <th class="col-recipe">{{ t('freeParam.colRecipe') }}</th>
                    <th class="col-act" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in taskRows" :key="row.id">
                    <td class="col-no muted">{{ row.taskNo }}</td>
                    <td class="col-num">
                      <input
                        v-model.number="row.diameter"
                        type="number"
                        class="fp-input"
                        :class="{ invalid: isDiameterInvalid(row.diameter) }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="isDiameterInvalid(row.diameter) ? t('freeParam.errDiameter') : ''"
                      />
                    </td>
                    <td class="col-num">
                      <input
                        v-model.number="row.angle"
                        type="number"
                        class="fp-input"
                        :class="{ invalid: isAngleInvalid(row.angle) }"
                        step="0.1"
                        min="-90"
                        max="90"
                        :title="isAngleInvalid(row.angle) ? t('freeParam.errAngle') : ''"
                      />
                    </td>
                    <td class="col-num">
                      <input v-model.number="row.compAngle" type="number" class="fp-input" step="0.01" />
                    </td>
                    <td class="col-num">
                      <input
                        v-model.number="row.height"
                        type="number"
                        class="fp-input"
                        :class="{ invalid: isHeightInvalid(row.height) }"
                        min="0"
                        max="20"
                        step="0.001"
                        :title="isHeightInvalid(row.height) ? t('freeParam.errHeight') : ''"
                      />
                    </td>
                    <td class="col-num">
                      <input
                        v-model.number="row.divisions"
                        type="number"
                        class="fp-input"
                        :class="{ invalid: isDivisionsInvalid(row.divisions) }"
                        :title="isDivisionsInvalid(row.divisions) ? t('freeParam.errDivisions') : ''"
                      />
                    </td>
                    <td class="col-num">
                      <input v-model.number="row.compX" type="number" class="fp-input" step="0.001" />
                    </td>
                    <td class="col-num">
                      <input v-model.number="row.compY" type="number" class="fp-input" step="0.001" />
                    </td>
                    <td class="col-num">
                      <input v-model.number="row.compZ" type="number" class="fp-input" step="0.001" />
                    </td>
                    <td class="col-num">
                      <input v-model.number="row.chordRatio" type="number" class="fp-input" step="0.1" />
                    </td>
                    <td class="col-recipe">
                      <select
                        v-model="row.recipe"
                        class="fp-select"
                        :class="{ invalid: isRecipeInvalid(row.recipe) }"
                        :title="isRecipeInvalid(row.recipe) ? t('freeParam.errRecipe') : ''"
                      >
                        <option value="">{{ t('freeParam.recipePlaceholder') }}</option>
                        <option v-for="r in activeMainRecipes" :key="r.id" :value="r.id">
                          {{ recipeLabel(r) }}
                        </option>
                      </select>
                    </td>
                    <td class="col-act">
                      <button
                        type="button"
                        class="fp-del"
                        :disabled="taskRows.length <= 1"
                        :title="t('freeParam.delete')"
                        @click="removeRow(row.id)"
                      >
                        <span class="material-symbols-outlined">close</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside class="fp-target-params">
            <div class="fp-target-params-head">
              <div class="fp-panel-label">
                <span class="material-symbols-outlined">tune</span>
                {{ t('freeParam.targetParamsTitle') }}
              </div>
            </div>
            <div v-if="activeTarget" class="fp-target-params-body">
              <div class="fp-param-card">
                <div class="fp-param-card-title">
                  <span class="material-symbols-outlined">rotate_right</span>
                  {{ t('freeParam.rCompensationLabel') }}
                </div>
                <label class="fp-field">
                  <span class="fp-field-label">{{ t('freeParam.rIntervalLabel') }}</span>
                  <input
                    v-model.number="activeTarget.rInterval"
                    type="number"
                    class="fp-input"
                    step="1"
                    min="0"
                  />
                </label>
                <label class="fp-field">
                  <span class="fp-field-label">
                    {{ t('freeParam.rCompensationLabel') }}
                    <span class="fp-field-unit">{{ t('freeParam.rCompensationUnit') }}</span>
                  </span>
                  <input
                    v-model.number="activeTarget.rCompensation"
                    type="number"
                    class="fp-input"
                    step="0.001"
                  />
                </label>
              </div>

              <div class="fp-param-card">
                <div class="fp-param-card-title">
                  <span class="material-symbols-outlined">my_location</span>
                  {{ t('freeParam.colPointXy') }}
                </div>
                <div class="fp-field-row">
                  <input
                    :value="activeTarget.pointXy"
                    type="text"
                    class="fp-input fp-xy-input"
                    :placeholder="t('freeParam.pointXyPlaceholder')"
                    readonly
                  />
                  <button
                    type="button"
                    class="fp-xy-btn"
                    :title="t('freeParam.captureXy')"
                    @click="capturePointXy"
                  >
                    <span class="material-symbols-outlined">gps_fixed</span>
                    {{ t('freeParam.captureXy') }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="fp-target-params-empty">{{ t('freeParam.targetParamsEmpty') }}</div>
          </aside>
        </div>
      </div>
    </div>

    <div v-else class="fp-draw-empty">
      <span class="material-symbols-outlined fp-draw-icon">draw</span>
      <p class="fp-draw-title">{{ t('freeParam.modeDrawImage') }}</p>
      <p class="fp-draw-desc">{{ t('freeParam.drawPlaceholder') }}</p>
    </div>

    <footer class="fp-footer">
      <span v-if="statusMsg" class="fp-status" :title="statusMsg">{{ statusMsg }}</span>
      <div class="fp-footer-spacer" />
      <input
        ref="fileInputRef"
        type="file"
        accept=".jjs,application/json"
        class="fp-file-input"
        @change="onFileChange"
      />
      <button type="button" class="fp-btn load" @click="onLoadClick">
        <span class="material-symbols-outlined">folder_open</span>
        {{ t('freeParam.load') }}
      </button>
      <button type="button" class="fp-btn save" @click="onSave">
        <span class="material-symbols-outlined">save</span>
        {{ t('freeParam.save') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.fp-page {
  --fp-radius: 12px;
  --fp-gap: 12px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 16px 18px 14px;
  gap: var(--fp-gap);
  background:
    radial-gradient(1200px 420px at 12% -10%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 60%),
    color-mix(in srgb, var(--color-surface) 94%, transparent);
}

/* ── Top bar ── */
.fp-top {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.fp-top-text { min-width: 0; }
.fp-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-on-surface);
}
.fp-sub {
  margin: 4px 0 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.85;
}
.fp-mode {
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  padding: 3px;
  min-width: min(420px, 48vw);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.fp-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.fp-mode-btn .material-symbols-outlined { font-size: 17px; }
.fp-mode-btn:hover:not(.active) {
  color: var(--color-on-surface);
  background: rgba(255, 255, 255, 0.04);
}
.fp-mode-btn.active {
  background: color-mix(in srgb, var(--color-primary) 26%, transparent);
  color: var(--color-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 50%, transparent),
    0 0 18px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

/* ── Shared panel chrome ── */
.fp-panel-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
.fp-panel-label .material-symbols-outlined {
  font-size: 16px;
  color: var(--color-primary);
  opacity: 0.9;
}

/* ── Body ── */
.fp-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--fp-gap);
  overflow: hidden;
}

/* ── Targets rail ── */
.fp-targets {
  width: 228px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: var(--fp-radius);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 6%, transparent), transparent 48px),
    color-mix(in srgb, var(--color-surface-container) 90%, transparent);
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.fp-targets-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
}
.fp-targets-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.fp-targets-add .material-symbols-outlined { font-size: 15px; }
.fp-targets-add:hover {
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-style: solid;
}
.fp-targets-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fp-target-item {
  display: flex;
  align-items: stretch;
  gap: 2px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}
.fp-target-item.active {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container-highest));
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
  box-shadow: inset 3px 0 0 0 var(--color-primary);
}
.fp-target-item:hover:not(.active) {
  background: color-mix(in srgb, var(--color-surface-container-high) 70%, transparent);
  border-color: color-mix(in srgb, var(--color-outline-variant) 60%, transparent);
}
.fp-target-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 10px 8px 10px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
}
.fp-target-index {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-on-surface-variant);
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.fp-target-item.active .fp-target-index {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
}
.fp-target-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fp-target-name {
  font-size: 13px;
  font-weight: 650;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fp-target-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
}
.fp-target-del {
  flex-shrink: 0;
  width: 30px;
  border: none;
  background: transparent;
  color: var(--color-outline);
  cursor: pointer;
  border-radius: 8px;
  margin: 4px 4px 4px 0;
  transition: background 0.15s, color 0.15s;
}
.fp-target-del .material-symbols-outlined { font-size: 16px; }
.fp-target-del:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
}
.fp-target-del:disabled { opacity: 0.28; cursor: not-allowed; }
.fp-target-rename {
  flex: 1;
  margin: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-primary);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  font-size: 13px;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

/* ── Workspace (right whole) ── */
.fp-workspace {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: var(--fp-radius);
  background: color-mix(in srgb, var(--color-surface-container) 92%, transparent);
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
}
.fp-workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 11px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 42%),
    color-mix(in srgb, var(--color-surface-container-high) 70%, transparent);
}
.fp-workspace-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.fp-workspace-kicker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-primary);
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 32%, transparent);
  white-space: nowrap;
}
.fp-workspace-kicker .material-symbols-outlined { font-size: 14px; }
.fp-toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.fp-active-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-on-surface);
  letter-spacing: -0.01em;
}
.fp-active-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
  opacity: 0.9;
}
.fp-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.fp-add .material-symbols-outlined { font-size: 16px; }
.fp-add:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 26%, transparent);
}
.fp-add:active:not(:disabled) { transform: translateY(1px); }
.fp-add:disabled { opacity: 0.4; cursor: not-allowed; }

.fp-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Target params rail ── */
.fp-target-params {
  width: 272px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid color-mix(in srgb, var(--color-outline-variant) 75%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 5%, transparent), transparent 80px),
    color-mix(in srgb, var(--color-surface-container-high) 40%, transparent);
  overflow: hidden;
}
.fp-target-params-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 60%, transparent);
}
.fp-target-params-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fp-target-params-empty {
  padding: 20px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-outline);
}
.fp-param-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 75%, transparent);
  background: color-mix(in srgb, var(--color-surface-container) 78%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.fp-param-card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 650;
  color: var(--color-on-surface);
}
.fp-param-card-title .material-symbols-outlined {
  font-size: 16px;
  color: var(--color-primary);
}
.fp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fp-field-label {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
.fp-field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp-field-row .fp-input { flex: 1; min-width: 0; }
.fp-field-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-outline);
  text-transform: none;
  letter-spacing: 0;
}
.fp-xy-input {
  flex: 1;
  min-width: 0;
  color: var(--color-on-surface);
  font-size: 11px;
}
.fp-xy-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-outline-variant));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.fp-xy-btn .material-symbols-outlined { font-size: 14px; }
.fp-xy-btn:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* ── Table ── */
.fp-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}
.fp-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.fp-table th,
.fp-table td {
  padding: 8px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 55%, transparent);
  text-align: center;
  vertical-align: middle;
}
.fp-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: color-mix(in srgb, var(--color-surface-container-high) 92%, transparent);
  backdrop-filter: blur(8px);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  white-space: normal;
  line-height: 1.25;
  word-break: break-word;
  border-bottom-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-outline-variant));
}
.fp-table tbody tr {
  transition: background 0.12s;
}
.fp-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--color-surface-container-high) 22%, transparent);
}
.fp-table tbody tr:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-container-highest));
}
/* 序号 / 操作固定窄列，其余参数列均分剩余宽度 */
.col-no {
  width: 44px;
  text-align: center;
}
.col-act {
  width: 40px;
}
.col-num,
.col-recipe {
  width: 9%;
}
.muted {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 650;
  color: var(--color-outline);
  text-align: center;
}
.fp-input,
.fp-select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 4px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 85%, transparent);
  background: color-mix(in srgb, var(--color-surface-container-lowest) 82%, transparent);
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  outline: none;
  text-align: center;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.fp-input:focus,
.fp-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.fp-input.invalid,
.fp-select.invalid {
  border-color: var(--color-error);
  color: var(--color-error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 14%, transparent);
}
.fp-input::-webkit-outer-spin-button,
.fp-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.fp-input[type='number'] { appearance: textfield; -moz-appearance: textfield; }
.fp-select {
  color: var(--color-on-surface);
  cursor: pointer;
}
.fp-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-outline);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.fp-del .material-symbols-outlined { font-size: 16px; }
.fp-del:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-error) 16%, transparent);
  color: var(--color-error);
}
.fp-del:disabled { opacity: 0.28; cursor: not-allowed; }

/* ── Empty / Footer ── */
.fp-draw-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: var(--fp-radius);
  background:
    radial-gradient(420px 180px at 50% 40%, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 70%),
    color-mix(in srgb, var(--color-surface-container) 72%, transparent);
  color: var(--color-on-surface-variant);
}
.fp-draw-icon {
  font-size: 52px;
  opacity: 0.4;
  color: var(--color-primary);
}
.fp-draw-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--color-on-surface);
}
.fp-draw-desc {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  opacity: 0.7;
}

.fp-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface-container) 85%, transparent);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.08);
}
.fp-footer-spacer { flex: 1; min-width: 0; }
.fp-status {
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}
.fp-file-input { display: none; }
.fp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
}
.fp-btn .material-symbols-outlined { font-size: 16px; }
.fp-btn:active { transform: translateY(1px); }
.fp-btn.load:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.fp-btn.save {
  border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  color: var(--color-primary);
}
.fp-btn.save:hover {
  background: color-mix(in srgb, var(--color-primary) 28%, transparent);
}
</style>
