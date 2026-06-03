<script setup lang="ts">
import type {
  CardRecipeItem,
  LinearFormulaCoefficients,
  RecipeCardType,
  VerticalProcessFormulaRecipe
} from '../recipeTypes'

const props = withDefaults(
  defineProps<{
    type: RecipeCardType
    item: CardRecipeItem
    deleteDisabled?: boolean
    warningText?: string
    cardClass?: string
    onUpdated?: (item: CardRecipeItem) => void
  }>(),
  {
    deleteDisabled: false,
    warningText: '',
    cardClass: 'app-card-soft rounded-2xl p-5'
  }
)

const emit = defineEmits<{
  (event: 'delete'): void
}>()

function markUpdated(): void {
  props.onUpdated?.(props.item)
}

function formatVerticalChangeFormula(formula?: LinearFormulaCoefficients): string {
  if (!formula) return '-'
  return `变化率 = ${formula.k} * 计算 + ${formula.b}`
}
</script>

<template>
  <div :class="props.cardClass">
    <div class="flex items-start justify-between gap-3">
      <div>
        <template v-if="props.type === 'horizontalFormula'">
          <p class="app-text-secondary text-xs">共享水平工艺配方</p>
          <p class="app-text-primary mt-1 text-base font-semibold">
            {{ props.item.name }}
          </p>
        </template>
        <template v-else-if="props.type === 'verticalFormula'">
          <p class="app-text-secondary text-xs">共享垂直工艺配方</p>
          <p class="app-text-primary mt-1 text-base font-semibold">
            {{ props.item.name }}
          </p>
        </template>
        <template v-else>
          <p class="app-text-primary text-lg font-semibold">{{ props.item.name }}</p>
        </template>
      </div>
      <button
        type="button"
        class="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="props.deleteDisabled"
        @click="emit('delete')"
      >
        删除
      </button>
    </div>

    <p v-if="props.warningText" class="mt-2 text-xs text-amber-600">
      {{ props.warningText }}
    </p>

    <template v-if="props.type === 'verticalFormula' || !props.type">
      <div class="mt-3 space-y-2">
        <div class="grid gap-2 lg:grid-cols-2">
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">配方名称</span>
            <input
              v-model="(props.item as VerticalProcessFormulaRecipe).name"
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
              v-model="(props.item as VerticalProcessFormulaRecipe).cuttingAxis"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>

          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">X_偏移量（mm）</span>
            <input
              v-model.number="(props.item as VerticalProcessFormulaRecipe).xFeed"
              type="number"
              step="0.001"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
              @input="markUpdated"
            />
          </label>
          <label class="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-xl border border-(--app-border) bg-(--app-card) px-3 py-2">
            <span class="app-text-secondary text-xs">插补运行速度（mm/s）</span>
            <input
              v-model.number="(props.item as VerticalProcessFormulaRecipe).xSpeed"
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
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).edgeCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">切割次数（次）</span>
                <input
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).edgeCutting.cutTimes"
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
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).edgeCutting.cutSpeedNums"
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
                  {{ formatVerticalChangeFormula((props.item as VerticalProcessFormulaRecipe).edgeCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).edgeCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).edgeCutting.change.b"
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
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).middleCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">切割次数（次）</span>
                <input
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).middleCutting.cutTimes"
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
                  {{ formatVerticalChangeFormula((props.item as VerticalProcessFormulaRecipe).middleCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).middleCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).middleCutting.change.b"
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
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).descentCutting.speed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">下降减少量(mm/{{(props.item as VerticalProcessFormulaRecipe).changePercent}}%)</span>
                <input
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).descentCutting.zFeed"
                  type="number"
                  step="0.001"
                  class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                  @input="markUpdated"
                />
              </label>
              <label class="grid grid-cols-[6rem_1fr] items-center gap-2">
                <span class="app-text-secondary text-xs">变化百分比（%）</span>
                <input
                  v-model.number="(props.item as VerticalProcessFormulaRecipe).changePercent"
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
                  {{ formatVerticalChangeFormula((props.item as VerticalProcessFormulaRecipe).descentCutting.change) }}
                </p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">K：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).descentCutting.change.k"
                      type="number"
                      step="0.001"
                      class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2 py-1.5 text-sm outline-none"
                      @input="markUpdated"
                    />
                  </label>
                  <label class="grid grid-cols-[2rem_1fr] items-center gap-2">
                    <span class="app-text-secondary text-xs">B：</span>
                    <input
                      v-model.number="(props.item as VerticalProcessFormulaRecipe).descentCutting.change.b"
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
      </div>
    </template>
  </div>
</template>
