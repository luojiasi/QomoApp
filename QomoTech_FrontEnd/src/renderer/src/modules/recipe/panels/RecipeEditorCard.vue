<script setup lang="ts">
import { computed } from 'vue'
import type {
  BlackeningProcessRecipe,
  LaserPowerRecipe,
  LaserTransmissionMode,
  LinearFormulaCoefficients,
  MachiningProcessRecipe,
  OpeningShape,
  ProcessFormulaRecipe,
  SharedFormulaRecipe,
  VerticalFormulaRecipe
} from '@/types/settings'

type RecipeCardType =
  | 'blackening'
  | 'machining'
  | 'laserPower'
  | 'horizontalFormula'
  | 'verticalFormula'
type ProcessDetailFieldKind = 'laserPower' | 'horizontal' | 'vertical'
type EditableFormulaKey =
  | 'angleFormula'
  | 'lowerOpeningFormula'
  | 'depthCompensationFormula'
  | 'compensationAngleFormula'
  
type FormulaKB = { k: number; b: number }
type OpeningShapeFormulaPreset = Partial<Record<EditableFormulaKey, FormulaKB>>

interface EditableFormulaItem {
  key: EditableFormulaKey
  label: string
  symbol: 'A' | 'L' | 'D' | 'CA'
  kLabel: string
  bLabel: string
}

type CardRecipeItem =
  | BlackeningProcessRecipe
  | MachiningProcessRecipe
  | LaserPowerRecipe
  | SharedFormulaRecipe
  | VerticalFormulaRecipe

const props = withDefaults(
  defineProps<{
    type: RecipeCardType
    item: CardRecipeItem
    deleteDisabled?: boolean
    warningText?: string
    cardClass?: string
    onUpdated?: (item: CardRecipeItem) => void
    onHoverEnter?: (recipeId: string, kind: ProcessDetailFieldKind) => void
    onHoverLeave?: () => void
    laserPowerOptions?: LaserPowerRecipe[]
    horizontalFormulaOptions?: SharedFormulaRecipe[]
    verticalFormulaOptions?: VerticalFormulaRecipe[]
    transmissionModeOptions?: LaserTransmissionMode[]
    openingShapeOptions?: OpeningShape[]
    openingShapeFormulaPresets?: Partial<Record<OpeningShape, OpeningShapeFormulaPreset>>
    editableFormulaItems?: EditableFormulaItem[]
    formatLinearFormula?: (
      symbol: 'A' | 'L' | 'D' | 'CA',
      formula?: ProcessFormulaRecipe[EditableFormulaKey]
    ) => string
  }>(),
  {
    deleteDisabled: false,
    warningText: '',
    cardClass: 'app-card-soft rounded-2xl p-5',
    laserPowerOptions: () => [],
    horizontalFormulaOptions: () => [],
    verticalFormulaOptions: () => [],
    transmissionModeOptions: () => [],
    openingShapeOptions: () => [],
    openingShapeFormulaPresets: () => ({}),
    editableFormulaItems: () => []
  }
)

const emit = defineEmits<{
  (event: 'delete'): void
}>()

const isSharedFormulaType = computed(
  () => props.type === 'horizontalFormula' || props.type === 'verticalFormula'
)

const headerClass = computed(() =>
  isSharedFormulaType.value ? 'flex items-start justify-between gap-3' : 'flex items-start justify-between gap-4'
)

const warningClass = computed(() =>
  isSharedFormulaType.value ? 'mt-2 text-xs text-amber-600' : 'mt-3 text-sm text-amber-600'
)

const deleteButtonClass = computed(() =>
  isSharedFormulaType.value
    ? 'rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
)

function markUpdated(): void {
  props.onUpdated?.(props.item)
}

function onRowHoverEnter(kind: ProcessDetailFieldKind): void {
  props.onHoverEnter?.(props.item.id, kind)
}

function onRowHoverLeave(): void {
  props.onHoverLeave?.()
}

function formatFormulaValue(
  symbol: 'A' | 'L' | 'D' | 'CA',
  formula?: ProcessFormulaRecipe[EditableFormulaKey]
): string {
  return props.formatLinearFormula ? props.formatLinearFormula(symbol, formula) : '-'
}

function onOpeningShapeChange(shape: OpeningShape): void {
  const recipe = props.item as SharedFormulaRecipe
  const presets = props.openingShapeFormulaPresets?.[shape]
  if (presets) {
    ;(Object.keys(presets) as EditableFormulaKey[]).forEach((key) => {
      const preset = presets[key]
      if (!preset) return
      recipe.formula[key].k = preset.k
      recipe.formula[key].b = preset.b
    })
  }
  markUpdated()
}

function formatVerticalChangeFormula(formula?: LinearFormulaCoefficients): string {
  if (!formula) return '-'
  return `变化率 = ${formula.k} * 计算 + ${formula.b}`
}
</script>

<template>
  <div :class="props.cardClass">
    <div :class="headerClass">
      <div>
        <template v-if="props.type === 'horizontalFormula'">
          <p class="app-text-secondary text-xs">共享水平工艺配方</p>
          <p class="app-text-primary mt-1 text-base font-semibold">
            {{ props.item.name }} / {{ props.item.code }}
          </p>
        </template>
        <template v-else-if="props.type === 'verticalFormula'">
          <p class="app-text-secondary text-xs">共享垂直工艺配方</p>
          <p class="app-text-primary mt-1 text-base font-semibold">
            {{ props.item.name }} / {{ props.item.code }}
          </p>
        </template>
        <template v-else>
          <p class="app-text-primary text-lg font-semibold">{{ props.item.name }}</p>
          <p class="app-text-secondary mt-1 text-sm">{{ props.item.code }}</p>
        </template>
      </div>
      <button
        type="button"
        :class="deleteButtonClass"
        :disabled="props.deleteDisabled"
        @click="emit('delete')"
      >
        删除
      </button>
    </div>

    <p v-if="props.warningText" :class="warningClass">
      {{ props.warningText }}
    </p>

    <template v-if="props.type === 'blackening'">
      <label class="mt-3 grid grid-cols-[6.5rem_1fr] items-center gap-2">
        <span class="app-text-secondary text-xs">是否启用该配方</span>
        <select
          v-model="(props.item as BlackeningProcessRecipe).enabled"
          class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
          @change="markUpdated"
        >
          <option :value="true" class="text-slate-900">启用</option>
          <option :value="false" class="text-slate-900">禁用</option>
        </select>
      </label>

      <div class="mt-4 grid gap-2 lg:grid-cols-2">
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">配方名称</span>
          <input
            v-model="(props.item as BlackeningProcessRecipe).name"
            type="text"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">配方编码</span>
          <input
            v-model="(props.item as BlackeningProcessRecipe).code"
            type="text"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>

      <div class="mt-3 grid gap-2 lg:grid-cols-4">
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">下降步长（mm）</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).descentStep"
            type="number"
            step="0.001"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">下降次数（次）</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).descentCount"
            type="number"
            step="1"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">扫黑速度（mm/s）</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).blackeningSpeed"
            type="number"
            step="1"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">扫黑步进（mm）</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).blackeningStep"
            type="number"
            step="0.001"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>
      <div class="mt-3 grid gap-2 lg:grid-cols-4">
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">焦距补偿（um）</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).jiaojubuchang"
            type="number"
            min="0"
            max="1000"
            step="1"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">扫黑开口K</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).saoheikaikou.k"
            type="number"

            step="1"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">扫黑开口B</span>
          <input
            v-model.number="(props.item as BlackeningProcessRecipe).saoheikaikou.b"
            type="number"
            step="0.01"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid not-only:items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">扫黑开口公式：K*高度+B</span>
        </label>
      </div>
      

      <label class="mt-3 grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
        <span class="app-text-secondary text-xs">激光功率配方</span>
        <select
          v-model="(props.item as BlackeningProcessRecipe).laserPowerRecipeId"
          class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
          @change="markUpdated"
        >
          <option
            v-for="lp in props.laserPowerOptions"
            :key="lp.id"
            :value="lp.id"
            class="text-slate-900"
          >
            {{ lp.name }} ({{ lp.code }})
          </option>
        </select>
      </label>

      <label class="mt-3 grid grid-cols-[6.5rem_1fr] items-start gap-2 rounded-xl border border-(--app-border) px-3 py-2">
        <span class="app-text-secondary mt-1 text-xs">备注</span>
        <textarea
          v-model="(props.item as BlackeningProcessRecipe).notes"
          rows="2"
          class="min-h-10 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
          @input="markUpdated"
        />
      </label>
    </template>

    <template v-else-if="props.type === 'machining'">
      <div class="mt-3 grid gap-2 lg:grid-cols-2">
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">配方名称</span>
          <input
            v-model="(props.item as MachiningProcessRecipe).name"
            type="text"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
        <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary text-xs">配方编码</span>
          <input
            v-model="(props.item as MachiningProcessRecipe).code"
            type="text"
            class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>

      <div class="mt-4 grid min-w-0 gap-2 lg:grid-cols-3">
        <div class="min-w-0" @mouseenter="onRowHoverEnter('laserPower')" @mouseleave="onRowHoverLeave">
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">激光功率配方</span>
            <select
              v-model="(props.item as MachiningProcessRecipe).laserPowerRecipeId"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markUpdated"
            >
              <option
                v-for="lp in props.laserPowerOptions"
                :key="lp.id"
                :value="lp.id"
                class="text-slate-900"
              >
                {{ lp.name }} ({{ lp.code }})
              </option>
            </select>
          </label>
          <p class="app-text-secondary mt-1.5 text-[11px] leading-snug">
            悬停此项在屏幕右侧查看激光功率详细参数
          </p>
        </div>



        <div class="min-w-0" @mouseenter="onRowHoverEnter('horizontal')" @mouseleave="onRowHoverLeave">
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">水平工艺配方</span>
            <select
              v-model="(props.item as MachiningProcessRecipe).horizontalFormulaId"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markUpdated"
            >
            <option
                v-for="formula in props.horizontalFormulaOptions"
                :key="formula.id"
                :value="formula.id"
                class="text-slate-900"
              >
                {{ formula.name }} ({{ formula.code }})
              </option>
            </select>
          </label>
          <p class="app-text-secondary mt-1.5 text-[11px] leading-snug">
            悬停此项在屏幕右侧查看激光功率详细参数
          </p>
        </div>


        <div class="min-w-0" @mouseenter="onRowHoverEnter('vertical')" @mouseleave="onRowHoverLeave">
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">垂直工艺配方</span>
            <select
              v-model="(props.item as MachiningProcessRecipe).verticalFormulaId"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markUpdated"
            >
            <option
                v-for="formula in props.verticalFormulaOptions"
                :key="formula.id"
                :value="formula.id"
                class="text-slate-900"
              >
                {{ formula.name }} ({{ formula.code }})
              </option>
            </select>
          </label>
          <p class="app-text-secondary mt-1.5 text-[11px] leading-snug">
            悬停此项在屏幕右侧查看垂直工艺详细参数
          </p>
        </div>
      </div>

      <label class="mt-4 grid grid-cols-[6.5rem_1fr] items-start gap-2 rounded-xl border border-(--app-border) px-3 py-2">
        <span class="app-text-secondary mt-1 text-xs">备注</span>
        <textarea
          v-model="(props.item as MachiningProcessRecipe).notes"
          rows="2"
          class="min-h-10 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
          @input="markUpdated"
        />
      </label>
    </template>

    <template v-else-if="props.type === 'laserPower'">
      <div class="mt-4 space-y-2">
        <div class="grid gap-2 lg:grid-cols-4">
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">配方名称</span>
            <input
              v-model="(props.item as LaserPowerRecipe).name"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">配方编码</span>
            <input
              v-model="(props.item as LaserPowerRecipe).code"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <!-- <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">激光厂家</span>
            <input
              v-model="(props.item as LaserPowerRecipe).laserManufacturer"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label> -->
          <!-- <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">使用传输方式</span>
            <select
              v-model="(props.item as LaserPowerRecipe).transmissionMode"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markUpdated"
            >
              <option v-for="mode in props.transmissionModeOptions" :key="mode" :value="mode" class="text-slate-900">
                {{ mode }}
              </option>
            </select>
          </label> -->
        </div>
        <div class="grid gap-2 lg:grid-cols-2">
          
        </div>
        <div class="grid gap-2 lg:grid-cols-3">
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">激光功率</span>
            <input
              v-model.number="(props.item as LaserPowerRecipe).laserPower"
              type="number"
              step="0.01"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">激光频率</span>
            <input
              v-model.number="(props.item as LaserPowerRecipe).laserFrequency"
              type="number"
              step="0.01"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6.5rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) px-3 py-2">
            <span class="app-text-secondary text-xs">激光电流</span>
            <input
              v-model.number="(props.item as LaserPowerRecipe).laserCurrent"
              type="number"
              step="0.01"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
        </div>
        <label class="grid grid-cols-[6.5rem_1fr] items-start gap-2 rounded-xl border border-(--app-border) px-3 py-2">
          <span class="app-text-secondary mt-1 text-xs">备注</span>
          <textarea
            v-model="(props.item as LaserPowerRecipe).notes"
            rows="2"
            class="min-h-10 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>
    </template>

    <template v-else-if="props.type === 'horizontalFormula'">
      <div class="mt-3 space-y-2">
        <div class="grid gap-2 lg:grid-cols-5">
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">配方名称</span>
            <input
              v-model="(props.item as SharedFormulaRecipe).name"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <!-- <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">配方编码</span>
            <input
              v-model="(props.item as SharedFormulaRecipe).code"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label> -->
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">工艺名称</span>
            <input
              v-model="(props.item as SharedFormulaRecipe).formula.name"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">开口形状</span>
            <select
              v-model="(props.item as SharedFormulaRecipe).formula.openingShape"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @change="onOpeningShapeChange((props.item as SharedFormulaRecipe).formula.openingShape)"
            >
              <option v-for="shape in props.openingShapeOptions" :key="shape" :value="shape" class="text-slate-900">
                {{ shape }}
              </option>
            </select>
          </label>
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">焦距补偿</span>
            <input
              v-model.number="(props.item as SharedFormulaRecipe).formula.focusCompensation"
              type="number"
              step="0.001"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <div class="rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <p class="app-text-secondary text-xs">上开口公式</p>
            <p class="app-text-primary mt-2 text-sm font-medium break-all">
              {{ (props.item as SharedFormulaRecipe).formula.upperOpeningFormula }}
            </p>
          </div>
        </div>

        <div class="grid gap-2 xl:grid-cols-4">
          <div
            v-for="item in props.editableFormulaItems"
            :key="`${props.type}-${(props.item as SharedFormulaRecipe).id}-${item.key}`"
            class="rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="app-text-secondary text-xs">{{ item.label }}</span>
              <span class="app-text-primary text-xs font-medium">
                {{ formatFormulaValue(item.symbol, (props.item as SharedFormulaRecipe).formula[item.key]) }}
              </span>
            </div>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">{{ item.kLabel }}</span>
                <input
                  v-model.number="(props.item as SharedFormulaRecipe).formula[item.key].k"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">{{ item.bLabel }}</span>
                <input
                  v-model.number="(props.item as SharedFormulaRecipe).formula[item.key].b"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
            </div>
          </div>
        </div>

        <label class="grid grid-cols-[7rem_1fr] items-start gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
          <span class="app-text-secondary mt-1 text-xs">备注</span>
          <textarea
            v-model="(props.item as SharedFormulaRecipe).notes"
            rows="2"
            class="min-h-10 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>
    </template>

    <template v-else>
      <div class="mt-3 space-y-2">
        <div class="grid gap-2 lg:grid-cols-2">
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">配方名称</span>
            <input
              v-model="(props.item as VerticalFormulaRecipe).name"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">配方编码</span>
            <input
              v-model="(props.item as VerticalFormulaRecipe).code"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
        </div>

        <div class="grid gap-2 lg:grid-cols-3">
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">切割轴（XY/R）</span>
            <input
              v-model="(props.item as VerticalFormulaRecipe).formula.cuttingAxis"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>

          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">X_偏移量（mm）</span>
            <input
              v-model.number="(props.item as VerticalFormulaRecipe).formula.xFeed"
              type="number"
              step="0.001"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">插补运行速度（mm/s）</span>
            <input
              v-model.number="(props.item as VerticalFormulaRecipe).formula.xSpeed"
              type="number"
              min="1"
              max="100"
              step="0.001"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
        </div>

        <div class="grid gap-2 lg:grid-cols-3">
          <div class="rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <p class="app-text-primary text-sm font-medium">边缘切割</p>
            <div class="mt-2 space-y-2">
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">速度百分比（%）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.edgeCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">切割次数（次）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.edgeCutting.cutTimes"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">切割速量（次）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.edgeCutting.cutSpeedNums"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <div class="rounded-lg border border-(--app-border) px-2 py-2">
                <p class="app-text-secondary text-xs">
                  {{ formatVerticalChangeFormula((props.item as VerticalFormulaRecipe).formula.edgeCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.edgeCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.edgeCutting.change.b"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <p class="app-text-primary text-sm font-medium">中间切割</p>
            <div class="mt-2 space-y-2">
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">速度百分比（%）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.middleCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">切割次数（次）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.middleCutting.cutTimes"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <div class="rounded-lg border border-(--app-border) px-2 py-2">
                <p class="app-text-secondary text-xs">
                  {{ formatVerticalChangeFormula((props.item as VerticalFormulaRecipe).formula.middleCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.middleCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.middleCutting.change.b"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <p class="app-text-primary text-sm font-medium">下降切割</p>
            <div class="mt-2 space-y-2">
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">下降量(mm/层)</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.descentCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">下降减少量(mm/{{(props.item as VerticalFormulaRecipe).formula.changePercent}}%)</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.descentCutting.zFeed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">变化百分比（%）</span>
                <input
                  v-model.number="(props.item as VerticalFormulaRecipe).formula.changePercent"
                  type="number"
                  min="5"
                  max="100"
                  step="1"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <div class="rounded-lg border border-(--app-border) px-2 py-2">
                <p class="app-text-secondary text-xs">
                  {{ formatVerticalChangeFormula((props.item as VerticalFormulaRecipe).formula.descentCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.descentCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalFormulaRecipe).formula.descentCutting.change.b"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <label class="grid grid-cols-[7rem_1fr] items-start gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
          <span class="app-text-secondary mt-1 text-xs">备注</span>
          <textarea
            v-model="(props.item as VerticalFormulaRecipe).notes"
            rows="2"
            class="min-h-10 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
            @input="markUpdated"
          />
        </label>
      </div>
    </template>
  </div>
</template>
