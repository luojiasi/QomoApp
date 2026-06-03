<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      @click.self="$emit('close')"
    >
      <div class="modal-container">
        <!-- 标题栏 -->
        <div class="modal-header">
          <div>
            <h3 class="modal-title">配方参数总览</h3>
            <p class="modal-subtitle">
              共 {{ rows.length }} 条主配方 ·
              <span class="legend-dot legend-active" /> 生效
              <span class="legend-dot legend-draft" /> 草稿
              <span class="legend-dot legend-archived" /> 归档
            </p>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <!-- 表头不参与纵向滚动，避免角标被表体覆盖 -->
        <div class="table-shell">
          <div
            ref="headScroller"
            class="table-head-scroller"
            @scroll="onHeadScroll"
          >
            <table class="param-table">
              <colgroup>
                <col class="col-fixed-name">
                <col class="col-fixed-status">
                <col
                  span="35"
                  class="col-data"
                >
              </colgroup>
              <thead>
              <tr>
                <th rowspan="2" class="th-sticky th-name">主配方名称</th>
                <th rowspan="2" class="th-sticky-2 th-status-col">状态</th>
                <th colspan="5" class="th-group th-group-blue">垂直 — 边缘切割</th>
                <th colspan="4" class="th-group th-group-blue">垂直 — 中间切割</th>
                <th colspan="5" class="th-group th-group-blue">垂直 — 下降切割</th>
                <th colspan="3" class="th-group th-group-blue">垂直 — 基础</th>
                <th rowspan="2" class="th-group th-group-purple">开口形状</th>
                <th colspan="2" class="th-group th-group-purple">角度公式</th>
                <th colspan="2" class="th-group th-group-purple">下开口公式</th>
                <th colspan="2" class="th-group th-group-purple">深度补偿</th>
                <th colspan="2" class="th-group th-group-purple">补偿角度</th>
                <th rowspan="2" class="th-group th-group-purple">焦距补偿</th>
                <th rowspan="2" class="th-group th-group-red">启用</th>
                <th rowspan="2" class="th-group th-group-red">下降步长</th>
                <th rowspan="2" class="th-group th-group-red">下降次数</th>
                <th rowspan="2" class="th-group th-group-red">扫黑速度</th>
                <th rowspan="2" class="th-group th-group-red">扫黑步进</th>
                <th rowspan="2" class="th-group th-group-red">焦距补偿</th>
                <th colspan="2" class="th-group th-group-red">扫黑开口</th>
              </tr>
              <tr>
                <th class="th-sub th-sub-blue">速度%</th>
                <th class="th-sub th-sub-blue">次数</th>
                <th class="th-sub th-sub-blue">速量</th>
                <th class="th-sub th-sub-blue">K</th>
                <th class="th-sub th-sub-blue">B</th>
                <th class="th-sub th-sub-blue">速度%</th>
                <th class="th-sub th-sub-blue">次数</th>
                <th class="th-sub th-sub-blue">K</th>
                <th class="th-sub th-sub-blue">B</th>
                <th class="th-sub th-sub-blue">下降量</th>
                <th class="th-sub th-sub-blue">减少量</th>
                <th class="th-sub th-sub-blue">变化%</th>
                <th class="th-sub th-sub-blue">K</th>
                <th class="th-sub th-sub-blue">B</th>
                <th class="th-sub th-sub-blue">轴</th>
                <th class="th-sub th-sub-blue">X偏移</th>
                <th class="th-sub th-sub-blue">速度</th>
                <th class="th-sub th-sub-purple">K</th>
                <th class="th-sub th-sub-purple">B</th>
                <th class="th-sub th-sub-purple">K</th>
                <th class="th-sub th-sub-purple">B</th>
                <th class="th-sub th-sub-purple">K</th>
                <th class="th-sub th-sub-purple">B</th>
                <th class="th-sub th-sub-purple">K</th>
                <th class="th-sub th-sub-purple">B</th>
                <th class="th-sub th-sub-red">K</th>
                <th class="th-sub th-sub-red">B</th>
              </tr>
              </thead>
            </table>
          </div>
          <div
            ref="bodyScroller"
            class="table-body-scroller"
            @scroll="onBodyScroll"
          >
            <table class="param-table">
              <colgroup>
                <col class="col-fixed-name">
                <col class="col-fixed-status">
                <col
                  span="35"
                  class="col-data"
                >
              </colgroup>
              <tbody>
              <tr
                v-for="row in rows"
                :key="row.mainRecipe.id"
                :class="rowClass(row.mainRecipe.status)"
              >
                <td class="td-name">{{ row.mainRecipe.name }}</td>
                <td class="td-status">
                  <span :class="statusBadgeClass(row.mainRecipe.status)">
                    {{ statusLabel(row.mainRecipe.status) }}
                  </span>
                </td>
                <td class="td-val td-blue">{{ row.vertical?.edgeCutting.speed ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.edgeCutting.cutTimes ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.edgeCutting.cutSpeedNums ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.edgeCutting.change.k ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.edgeCutting.change.b ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.middleCutting.speed ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.middleCutting.cutTimes ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.middleCutting.change.k ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.middleCutting.change.b ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.descentCutting.speed ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.descentCutting.zFeed ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.changePercent ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.descentCutting.change.k ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.descentCutting.change.b ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.cuttingAxis ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.xFeed ?? '-' }}</td>
                <td class="td-val td-blue">{{ row.vertical?.xSpeed ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.openingShape ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.angleFormula.k ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.angleFormula.b ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.lowerOpeningFormula.k ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.lowerOpeningFormula.b ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.depthCompensationFormula.k ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.depthCompensationFormula.b ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.compensationAngleFormula.k ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.compensationAngleFormula.b ?? '-' }}</td>
                <td class="td-val td-purple">{{ row.horizontal?.focusCompensation ?? '-' }}</td>
                <td class="td-val td-red">
                  <span v-if="row.blackening?.enabled === true" class="text-green-600">✓</span>
                  <span v-else-if="row.blackening?.enabled === false" class="text-red-600">✗</span>
                  <span v-else>-</span>
                </td>
                <td class="td-val td-red">{{ row.blackening?.descentStep ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.descentCount ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.blackeningSpeed ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.blackeningStep ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.jiaojubuchang ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.saoheikaikou.k ?? '-' }}</td>
                <td class="td-val td-red">{{ row.blackening?.saoheikaikou.b ?? '-' }}</td>
              </tr>
              <tr v-if="!rows.length">
                <td :colspan="37" class="td-empty">暂无主配方数据</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  BlackeningProcessRecipe,
  MainRecipeDefinition,
  MachiningProcessRecipe,
  ProcessFormulaRecipe,
  RecipeStatus,
  VerticalProcessFormulaRecipe
} from '../recipeTypes'
import { useRecipeSettingsStore } from '../useRecipeStore'

const props = defineProps<{
  visible: boolean
}>()

defineEmits<{
  close: []
}>()

const recipeStore = useRecipeSettingsStore()
const recipeState = computed(() => recipeStore.recipeState)

const headScroller = ref<HTMLElement | null>(null)
const bodyScroller = ref<HTMLElement | null>(null)
let syncingScroll = false

function onBodyScroll() {
  if (syncingScroll || !headScroller.value || !bodyScroller.value) return
  syncingScroll = true
  headScroller.value.scrollLeft = bodyScroller.value.scrollLeft
  syncingScroll = false
}

function onHeadScroll() {
  if (syncingScroll || !headScroller.value || !bodyScroller.value) return
  syncingScroll = true
  bodyScroller.value.scrollLeft = headScroller.value.scrollLeft
  syncingScroll = false
}

interface RecipeRow {
  mainRecipe: MainRecipeDefinition
  blackening: BlackeningProcessRecipe | null
  machining: MachiningProcessRecipe | null
  horizontal: ProcessFormulaRecipe | null
  vertical: VerticalProcessFormulaRecipe | null
}

const rows = computed<RecipeRow[]>(() => {
  const { mainRecipes, blackeningRecipes, machiningRecipes, horizontalFormulaRecipes, verticalFormulaRecipes } = recipeState.value

  return mainRecipes.map((main) => {
    const blackening = blackeningRecipes.find((r) => r.id === main.blackeningRecipeId) ?? null
    const machining = machiningRecipes.find((r) => r.id === main.machiningRecipeId) ?? null
    const horizontal = machining
      ? horizontalFormulaRecipes.find((r) => r.id === machining.horizontalFormulaId) ?? null
      : null
    const vertical = machining
      ? verticalFormulaRecipes.find((r) => r.id === machining.verticalFormulaId) ?? null
      : null

    return { mainRecipe: main, blackening, machining, horizontal, vertical }
  })
})

const STATUS_LABELS: Record<RecipeStatus, string> = {
  active: '生效',
  draft: '草稿',
  archived: '归档'
}

function statusLabel(status: RecipeStatus): string {
  return STATUS_LABELS[status]
}

function rowClass(status: RecipeStatus): string {
  return `row-${status}`
}

function statusBadgeClass(status: RecipeStatus): string {
  return `badge badge-${status}`
}
</script>

<style scoped>
/* ===== 遮罩 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 弹窗容器 ===== */
.modal-container {
  width: 94vw;
  max-height: 88vh;
  background: var(--app-card);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ===== 标题栏 ===== */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-card-soft);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  color: var(--app-text-primary);
}

.modal-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-left: 6px;
}

.legend-active  { background: #16a34a; }
.legend-draft   { background: #dc2626; }
.legend-archived { background: #ca8a04; }

.close-btn {
  padding: 6px 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.15s;
}

.close-btn:hover {
  background: var(--app-border);
}

/* ===== 表格容器 ===== */
.table-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.table-head-scroller {
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.table-head-scroller::-webkit-scrollbar {
  display: none;
}

/* 横向显示滚动条，纵向可滚但隐藏滚动条 */
.table-body-scroller {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.55) transparent;
}

.table-body-scroller::-webkit-scrollbar {
  width: 0;
  height: 10px;
}

.table-body-scroller::-webkit-scrollbar:vertical {
  width: 0;
  display: none;
}

.table-body-scroller::-webkit-scrollbar:horizontal {
  height: 10px;
}

.table-body-scroller::-webkit-scrollbar-track:horizontal {
  background: var(--app-card-soft);
}

.table-body-scroller::-webkit-scrollbar-thumb:horizontal {
  background: rgba(100, 116, 139, 0.45);
  border-radius: 5px;
}

.table-body-scroller::-webkit-scrollbar-thumb:horizontal:hover {
  background: rgba(100, 116, 139, 0.65);
}

/* ===== 表格 ===== */
.param-table {
  --col-name-width: 140px;
  --col-status-width: 80px;
  --col-data-width: 62px;
  --param-table-width: calc(
    var(--col-name-width) + var(--col-status-width) + 35 * var(--col-data-width)
  );
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
  width: var(--param-table-width);
  min-width: var(--param-table-width);
}

.col-fixed-name {
  width: var(--col-name-width);
}

.col-fixed-status {
  width: var(--col-status-width);
}

.col-data {
  width: var(--col-data-width);
}

/* ===== 表头 ===== */
.th-sticky {
  position: sticky;
  left: 0;
  z-index: 3;
  padding: 10px 16px;
  border: 1px solid var(--app-border);
  border-top: 4px solid #1e293b;
  background: var(--app-card-soft);
  width: var(--col-name-width);
  min-width: var(--col-name-width);
  max-width: var(--col-name-width);
  box-sizing: border-box;
  text-align: left;
  color: var(--app-text-primary);
  box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.12);
}

.th-sticky-2 {
  position: sticky;
  left: var(--col-name-width);
  z-index: 3;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-top: 4px solid #1e293b;
  background: var(--app-card-soft);
  width: var(--col-status-width);
  min-width: var(--col-status-width);
  max-width: var(--col-status-width);
  box-sizing: border-box;
  color: var(--app-text-primary);
  box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.12);
}

.th-name {
  text-align: left;
}

.th-status-col {
  text-align: center;
}

/* 分组标题 — 彩色顶边 */
.th-group {
  padding: 8px;
  border: 1px solid var(--app-border);
  font-weight: 600;
  font-size: 12px;
  color: var(--app-text-primary);
  background: var(--app-card-soft);
}

.th-group-blue  { border-top: 4px solid #3b82f6; }
.th-group-purple { border-top: 4px solid #8b5cf6; }
.th-group-red   { border-top: 4px solid #ef4444; }

/* 子列标题 */
.th-sub {
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
  min-width: 60px;
  background: var(--app-card-soft);
}

.th-sub-blue  { background: #eff6ff; }
.th-sub-purple { background: #f5f3ff; }
.th-sub-red   { background: #fef2f2; }

/* ===== 数据单元格 ===== */
.td-name {
  position: sticky;
  left: 0;
  z-index: 1;
  padding: 8px 16px;
  border: 1px solid var(--app-border);
  font-weight: 600;
  font-size: 12px;
  width: var(--col-name-width);
  min-width: var(--col-name-width);
  max-width: var(--col-name-width);
  box-sizing: border-box;
  background: var(--app-card);
  box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.12);
}

.td-status {
  position: sticky;
  left: var(--col-name-width);
  z-index: 1;
  padding: 8px;
  border: 1px solid var(--app-border);
  width: var(--col-status-width);
  min-width: var(--col-status-width);
  max-width: var(--col-status-width);
  box-sizing: border-box;
  text-align: center;
  background: var(--app-card);
  box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.12);
}

.td-val {
  padding: 7px 8px;
  border: 1px solid var(--app-border);
  text-align: center;
  color: var(--app-text-primary);
  white-space: nowrap;
}

/* 列组淡色背景 */
.td-blue  { background: #eff6ff; }
.td-purple { background: #f5f3ff; }
.td-red   { background: #fef2f2; }

.td-empty {
  padding: 24px;
  text-align: center;
  color: var(--app-text-muted);
  border: 1px solid var(--app-border);
}

/* ===== 状态行背景（覆盖列组背景） ===== */
.row-active .td-val { background: #f0fdf4; }
.row-draft .td-val { background: #fef2f2; }
.row-archived .td-val { background: #fefce8; }

.row-active .td-name,
.row-active .td-status {
  background: #f0fdf4;
}

.row-draft .td-name,
.row-draft .td-status {
  background: #fef2f2;
}

.row-archived .td-name,
.row-archived .td-status {
  background: #fefce8;
}

/* ===== dark 模式 ===== */
:root[data-theme='dark'] .th-sub-blue,
:root[data-theme='dark'] .td-blue {
  background: rgba(59, 130, 246, 0.06);
}

:root[data-theme='dark'] .th-sub-purple,
:root[data-theme='dark'] .td-purple {
  background: rgba(139, 92, 246, 0.06);
}

:root[data-theme='dark'] .th-sub-red,
:root[data-theme='dark'] .td-red {
  background: rgba(239, 68, 68, 0.05);
}

:root[data-theme='dark'] .row-active .td-val,
:root[data-theme='dark'] .row-active .td-name,
:root[data-theme='dark'] .row-active .td-status {
  background: rgba(22, 163, 74, 0.1);
}

:root[data-theme='dark'] .row-draft .td-val,
:root[data-theme='dark'] .row-draft .td-name,
:root[data-theme='dark'] .row-draft .td-status {
  background: rgba(220, 38, 38, 0.08);
}

:root[data-theme='dark'] .row-archived .td-val,
:root[data-theme='dark'] .row-archived .td-name,
:root[data-theme='dark'] .row-archived .td-status {
  background: rgba(202, 138, 4, 0.1);
}

/* ===== 状态标签 ===== */
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
}

.badge-active   { background: #16a34a; }
.badge-draft    { background: #dc2626; }
.badge-archived { background: #ca8a04; }
</style>
