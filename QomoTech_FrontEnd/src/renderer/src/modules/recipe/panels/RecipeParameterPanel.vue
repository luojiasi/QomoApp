<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CollapsiblePanelHeader from '@/shared/components/CollapsiblePanelHeader.vue'
import { useRecipeSettingsStore } from '../useRecipeStore'
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'
import { storeToRefs } from 'pinia'
import type { MainRecipeDefinition, ProcessFormulaRecipe } from '../recipeTypes'

const recipeStore = useRecipeSettingsStore()
const emit = defineEmits<{
  (e: 'run-recipe-change', payload: Record<string, unknown> | null): void
  (e: 'upper-opening-change', mm: number | null): void
}>()

const selectedActiveMainRecipeId = ref('')
const workpieceHeight = ref<number | null>(null)
const isProcessPanelExpanded = ref(true)

const qomo5pStore = useQomo5PStore()
const { entities } = storeToRefs(qomo5pStore)

const activeMainRecipes = computed(() =>recipeStore.recipeState.mainRecipes.filter((recipe) => recipe.status === 'active'))

const selectedActiveMainRecipe = computed<MainRecipeDefinition | null>(() =>activeMainRecipes.value.find((recipe) => recipe.id === selectedActiveMainRecipeId.value) ??activeMainRecipes.value[0] ??null)

const selectedMachiningRecipe = computed(() => {
  const main = selectedActiveMainRecipe.value
  if (!main) return null
  return recipeStore.recipeState.machiningRecipes.find((recipe) => recipe.id === main.machiningRecipeId) ?? null
})

const selectedBlackeningRecipe = computed(() => {
  const main = selectedActiveMainRecipe.value
  if (!main) return null
  return (
    recipeStore.recipeState.blackeningRecipes.find((recipe) => recipe.id === main.blackeningRecipeId) ?? null
  )
})

const selectedVerticalFormula = computed(() => {
  const machining = selectedMachiningRecipe.value
  if (!machining) return null
  return (recipeStore.recipeState.verticalFormulaRecipes.find((recipe) => recipe.id === machining.verticalFormulaId) ?? null)
})

const selectedHorizontalFormula = computed(() => {
  const machining = selectedMachiningRecipe.value
  if (!machining) return null
  return (recipeStore.recipeState.horizontalFormulaRecipes.find((recipe) => recipe.id === machining.horizontalFormulaId) ?? null)
})

const selectedBlackeningLaserRecipe = computed(() => {
  const blackening = selectedBlackeningRecipe.value
  if (!blackening) return null
  return (recipeStore.recipeState.laserPowerRecipes.find((recipe) => recipe.id === blackening.laserPowerRecipeId) ?? null)
})

const selectedMachiningLaserRecipe = computed(() => {
  const machining = selectedMachiningRecipe.value
  if (!machining) return null
  return (recipeStore.recipeState.laserPowerRecipes.find((recipe) => recipe.id === machining.laserPowerRecipeId) ?? null)
})

watch(
  activeMainRecipes,
  (recipes) => {
    if (!recipes.length) {
      selectedActiveMainRecipeId.value = ''
      return
    }

    const stillActive = recipes.some((recipe) => recipe.id === selectedActiveMainRecipeId.value)
    if (!stillActive) selectedActiveMainRecipeId.value = recipes[0].id
  },
  { immediate: true }
)





// 计算开口
function computeAngleValue(formula: ProcessFormulaRecipe['angleFormula'],height: number): number {return formula.b + formula.k*height }
function computeLowerOpeningValue(formula: ProcessFormulaRecipe['lowerOpeningFormula'], height: number): number {return formula.k * height + formula.b}
function computeDepthCompensationValue(formula: ProcessFormulaRecipe['depthCompensationFormula'], height: number,angle: number,lowerOpening: number): number {return formula.k * (height+formula.b) * Math.tan(angle * Math.PI / 180)*1000 + lowerOpening }
// function computeCompensationAngleValue(formula: ProcessFormulaRecipe['compensationAngleFormula'], height: number): number {return formula.k * height + formula.b}


/** 开口按水平工艺配方的角度 / 下开口 / 深度补偿公式计算（垂直配方已不再包含这些字段）。 */
function calculateUpperOpening(height: number): number | null {
  if (!Number.isFinite(height)) return null
  const formula = selectedHorizontalFormula.value?.formula
  if (!formula) return null
  const angle = computeAngleValue(formula.angleFormula,height)
  const lowerOpening = computeLowerOpeningValue(formula.lowerOpeningFormula, height)
  const depthCompensation = computeDepthCompensationValue(formula.depthCompensationFormula,height,angle,lowerOpening)
  return Number.isFinite(depthCompensation) ? depthCompensation : null
}

/** 与只读展示一致的上开口数值（mm），供 Home 画布偏移层使用 */
const upperOpeningMm = computed<number | null>(() => {
  if (workpieceHeight.value === null || workpieceHeight.value < 0) return null
  return calculateUpperOpening(workpieceHeight.value)
})

const readonlyUpperOpening = computed(() => {
  const upper = upperOpeningMm.value
  return upper === null ? '-' : upper.toFixed(0)
})

watch(
  upperOpeningMm,
  (mm) => {
    emit('upper-opening-change', mm)
  },
  { immediate: true }
)

/**
 * 高度(mm)来源：
 * - 当 `HomeOperationHelp.vue` 导入/新建后，store 里存在实体时：取所有实体 `extrudeHeight` 的最小值（取绝对值后取 min）
 * - 当没有实体时：高度为空
 */
const derivedExtraHeight = computed<number | null>(() => {
  if (!entities.value.length) return null
  const heights = entities.value
    .map((e) => (typeof e.extrudeHeight === 'number' ? Math.abs(e.extrudeHeight) : NaN))
    .filter((n) => Number.isFinite(n))
  if (!heights.length) return null
  return Math.min(...heights)
})

watch(
  derivedExtraHeight,
  (h) => {
    workpieceHeight.value = h
  },
  { immediate: true }
)



function uniqueById<T extends { id: string }>(items: Array<T | null>): T[] {
  const map = new Map<string, T>()
  items.forEach((item) => {if (item) map.set(item.id, item)})
  return Array.from(map.values())
}




// 下发配方时需要的数据
const runRecipePayload = computed<Record<string, unknown> | null>(() => {
  const main = selectedActiveMainRecipe.value
  const blackening = selectedBlackeningRecipe.value
  const machining = selectedMachiningRecipe.value
  const blackeningLaser = selectedBlackeningLaserRecipe.value
  const machiningLaser = selectedMachiningLaserRecipe.value
  const vertical = selectedVerticalFormula.value
  const horizontal = selectedHorizontalFormula.value
  if (
    !main ||
    !blackening ||
    !machining ||
    !blackeningLaser ||
    !machiningLaser ||
    !vertical ||
    !horizontal
  ) {
    return null
  }

  const selectedLaserRecipe = uniqueById([blackeningLaser, machiningLaser])
  const selectedHorizontal = uniqueById([horizontal])
  const selectedVertical = uniqueById([vertical])

  return {
    selectedMainRecipe: main,
    selectedBlackeningRecipe: [blackening],
    selectedMachiningRecipe: [machining],
    selectedLaserRecipe,
    selectedHorizontal,
    selectedVertical,
    // 配方下发时附带的“高度”。后端目前仅回显 payload，但预留字段用于真正执行。
    extraHeight: workpieceHeight.value,
    MainRecipeChild: [main.blackeningRecipeId, main.machiningRecipeId],
    BlackeningRecipeChild: [blackening.laserPowerRecipeId],
    MachiningRecipeChild: [machining.laserPowerRecipeId, machining.horizontalFormulaId, machining.verticalFormulaId]
  }
})

watch(
  runRecipePayload,
  (payload) => {emit('run-recipe-change', payload)},{ immediate: true }
)
// 下发配方时需要的数据





onMounted(async () => {
  await recipeStore.loadRecipeState()
})
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isProcessPanelExpanded ? 'min-h-[min(100px,42vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isProcessPanelExpanded"
      title="配方参数面板"
    />

    <div class="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        
        <div class="flex w-full min-w-0 items-center gap-3">
          <label class="flex flex-1 min-w-0 items-center gap-2">
          <!-- <span class="shrink-0 text-xs text-(--app-text-muted)">选择需要的配方:</span> -->
          <select
            v-model="selectedActiveMainRecipeId"
            class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition scheme-light focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-black/40 dark:scheme-dark"
            :disabled="!activeMainRecipes.length"
          >
            <option value="" disabled class="bg-(--app-input-bg) text-(--app-text-muted)">请选择主配方</option>
            <option
              v-for="recipe in activeMainRecipes"
              :key="recipe.id"
              :value="recipe.id"
              class="bg-(--app-input-bg) text-(--app-text-primary)"
            >
              {{ recipe.name }}
            </option>
          </select>
        </label>
        <p v-if="!activeMainRecipes.length" class=" text-xs text-amber-700 dark:text-amber-400">
          当前没有可用的启用主配方，请先在配方管理中激活配方。
        </p>

          <label class="flex min-w-0 flex-1 items-center gap-2">
            <input
              v-model.number="workpieceHeight"
              :readonly="true"
              type="number"
              min="0"
              step="0.001"
              class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
              placeholder="-"
            />
          </label>
          <label class="flex min-w-0 flex-1 items-center gap-2">
            <input
              :value="readonlyUpperOpening"
              type="text"
              readonly
              class="min-w-0 flex-1 cursor-not-allowed rounded-lg border border-sky-300/50 bg-(--app-input-bg) px-3 py-2 text-sm font-semibold text-sky-700 shadow-inner shadow-slate-900/5 outline-none dark:border-sky-400/35 dark:text-sky-300 dark:shadow-black/40"
              placeholder="-"
            />
          </label>
        </div>
      </div>

    </div>
  </div>
</template>
