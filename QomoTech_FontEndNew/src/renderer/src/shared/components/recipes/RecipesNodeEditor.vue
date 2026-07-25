<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../../l10n'
import type { RecipeChainNode } from '../../recipe'
import type {
  MainRecipe,
  LaserPowerRecipe,
  BlackeningRecipe,
  MachiningRecipe,
  HorizontalFormulaRecipe,
  VerticalFormulaRecipe,
  RecipeStatePayload
} from '../../recipe'
import RecipeUnitValue from './RecipeUnitValue.vue'
import RecipeKbValue from './RecipeKbValue.vue'

const props = withDefaults(
  defineProps<{
    node: RecipeChainNode
    state: RecipeStatePayload
    main?: MainRecipe
    laser?: LaserPowerRecipe
    blackening?: BlackeningRecipe
    machining?: MachiningRecipe
    horizontal?: HorizontalFormulaRecipe
    vertical?: VerticalFormulaRecipe
    showStepper?: boolean
    breadcrumb?: string[]
  }>(),
  { showStepper: true }
)

export type CreateAndLinkTarget =
  | 'blackeningRecipeId'
  | 'machiningRecipeId'
  | 'laserPowerRecipeId'
  | 'horizontalFormulaId'
  | 'verticalFormulaId'

const emit = defineEmits<{
  prev: []
  next: []
  'update-main': [key: keyof MainRecipe, value: string]
  'update-list-item': [listKey: string, id: string, fieldPath: string, value: unknown]
  'create-and-link': [target: CreateAndLinkTarget]
}>()

const { t } = useL10n()

const kindLabelKey: Record<RecipeChainNode['kind'], string> = {
  main: 'recipes.typeMain',
  laser: 'recipes.typeLaser',
  blackening: 'recipes.typeBlackening',
  machining: 'recipes.typeMachining',
  horizontal: 'recipes.typeHorizontal',
  vertical: 'recipes.typeVertical'
}

const title = computed(() => {
  const label = props.node.label?.trim()
  return label || t('recipes.pendingSelect')
})

const breadcrumbItems = computed(() =>
  (props.breadcrumb ?? []).map((s) => s.trim()).filter(Boolean)
)

const blackeningOptions = computed(() => props.state.blackeningRecipes ?? [])
const machiningOptions = computed(() => props.state.machiningRecipes ?? [])
const laserOptions = computed(() => props.state.laserPowerRecipes ?? [])
const horizontalOptions = computed(() => props.state.horizontalFormulaRecipes ?? [])
const verticalOptions = computed(() => props.state.verticalFormulaRecipes ?? [])

function optLabel(item: { id: string; name?: string }): string {
  return (item.name && item.name.trim()) || item.id
}

function updateList(listKey: string, id: string, fieldPath: string, value: unknown): void {
  emit('update-list-item', listKey, id, fieldPath, value)
}
</script>

<template>
  <section class="rne">
    <header class="rne-head">
      <div class="rne-head-text">
        <p class="rne-sub">{{ t(kindLabelKey[node.kind]) }}</p>
        <nav v-if="breadcrumbItems.length" class="rne-crumb" aria-label="breadcrumb">
          <template v-for="(item, i) in breadcrumbItems" :key="`${i}-${item}`">
            <span v-if="i > 0" class="rne-crumb-sep"> / </span>
            <span class="rne-crumb-item" :class="{ current: i === breadcrumbItems.length - 1 }">
              {{ item }}
            </span>
          </template>
        </nav>
        <h2 class="rne-title" :class="{ pending: !node.label?.trim() || node.missing }">
          {{ title }}
        </h2>
      </div>
      <div v-if="showStepper" class="rne-stepper">
        <button type="button" class="rne-step" @click="emit('prev')">
          <span class="material-symbols-outlined">chevron_left</span>
          {{ t('recipes.prevStep') }}
        </button>
        <button type="button" class="rne-step" @click="emit('next')">
          {{ t('recipes.nextStep') }}
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </header>

    <div class="rne-body">
      <!-- main -->
      <div v-if="node.kind === 'main'" class="rne-panel">
        <div v-if="!main" class="rne-empty">
          <span class="material-symbols-outlined rne-empty-icon">edit_note</span>
          <span>{{ t('recipes.selectOrCreate') }}</span>
        </div>
        <div v-else class="field-grid">
          <div class="field">
            <label class="fl">{{ t('recipes.fieldName') }}</label>
            <input
              class="fi"
              :value="main.name"
              @input="emit('update-main', 'name', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field">
            <label class="fl">{{ t('recipes.fieldStatus') }}</label>
            <div class="select-wrap">
              <select
                class="fi"
                :value="main.status ?? 'draft'"
                @change="emit('update-main', 'status', ($event.target as HTMLSelectElement).value)"
              >
                <option value="active">{{ t('recipes.statusActive') }}</option>
                <option value="draft">{{ t('recipes.statusDraft') }}</option>
              </select>
              <span class="material-symbols-outlined select-arrow">expand_more</span>
            </div>
          </div>
          <div class="field">
            <label class="fl">{{ t('recipes.typeBlackening') }}</label>
            <div class="ref-row">
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="main.blackeningRecipeId"
                  @change="emit('update-main', 'blackeningRecipeId', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('recipes.pendingSelect') }}</option>
                  <option v-for="b in blackeningOptions" :key="b.id" :value="b.id">{{ optLabel(b) }}</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              <button type="button" class="ref-create" @click="emit('create-and-link', 'blackeningRecipeId')">
                {{ t('recipes.createAndLink') }}
              </button>
            </div>
          </div>
          <div class="field">
            <label class="fl">{{ t('recipes.typeMachining') }}</label>
            <div class="ref-row">
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="main.machiningRecipeId"
                  @change="emit('update-main', 'machiningRecipeId', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('recipes.pendingSelect') }}</option>
                  <option v-for="m in machiningOptions" :key="m.id" :value="m.id">{{ optLabel(m) }}</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              <button type="button" class="ref-create" @click="emit('create-and-link', 'machiningRecipeId')">
                {{ t('recipes.createAndLink') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- laser -->
      <div v-else-if="node.kind === 'laser'" class="rne-panel">
        <div v-if="!laser || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <div class="unit-grid">
            <RecipeUnitValue
              :label="t('recipes.fieldPower')"
              :model-value="laser.laserPower"
              :unit="t('recipes.unitW')"
              @update:model-value="updateList('laserPowerRecipes', laser.id, 'laserPower', $event)"
            />
            <RecipeUnitValue
              :label="t('recipes.fieldFrequency')"
              :model-value="laser.laserFrequency"
              :unit="t('recipes.unitHz')"
              @update:model-value="updateList('laserPowerRecipes', laser.id, 'laserFrequency', $event)"
            />
            <RecipeUnitValue
              :label="t('recipes.fieldCurrent')"
              :model-value="laser.laserCurrent"
              :unit="t('recipes.unitA')"
              @update:model-value="updateList('laserPowerRecipes', laser.id, 'laserCurrent', $event)"
            />
          </div>
          <div class="field-grid field-grid-top">
            <div class="field">
              <label class="fl">{{ t('recipes.fieldManufacturer') }}</label>
              <input
                class="fi mono"
                :value="laser.laserManufacturer ?? ''"
                @input="updateList('laserPowerRecipes', laser.id, 'laserManufacturer', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- blackening -->
      <div v-else-if="node.kind === 'blackening'" class="rne-panel">
        <div v-if="!blackening || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <div v-else class="field-grid">
          <div class="field">
            <label class="fl">{{ t('recipes.fieldEnabled') }}</label>
            <div class="select-wrap">
              <select
                class="fi"
                :value="String(blackening.enabled)"
                @change="updateList('blackeningRecipes', blackening.id, 'enabled', ($event.target as HTMLSelectElement).value === 'true')"
              >
                <option value="true">{{ t('recipes.fieldYes') }}</option>
                <option value="false">{{ t('recipes.fieldNo') }}</option>
              </select>
              <span class="material-symbols-outlined select-arrow">expand_more</span>
            </div>
          </div>
          <RecipeUnitValue
            :label="t('recipes.fieldDescentStep')"
            :model-value="blackening.descentStep"
            :unit="t('recipes.unitMm')"
            :step="0.01"
            @update:model-value="updateList('blackeningRecipes', blackening.id, 'descentStep', $event)"
          />
          <div class="field">
            <label class="fl">{{ t('recipes.fieldDescentCount') }}</label>
            <input
              class="fi"
              type="number"
              :value="blackening.descentCount"
              @input="updateList('blackeningRecipes', blackening.id, 'descentCount', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <RecipeUnitValue
            :label="t('recipes.fieldBlackeningSpeed')"
            :model-value="blackening.blackeningSpeed"
            :unit="t('recipes.unitMmPerS')"
            @update:model-value="updateList('blackeningRecipes', blackening.id, 'blackeningSpeed', $event)"
          />
          <RecipeUnitValue
            :label="t('recipes.fieldBlackeningStep')"
            :model-value="blackening.blackeningStep"
            :unit="t('recipes.unitMm')"
            :step="0.001"
            @update:model-value="updateList('blackeningRecipes', blackening.id, 'blackeningStep', $event)"
          />
          <div class="field">
            <label class="fl">{{ t('recipes.fieldJiaojubuchang') }}</label>
            <input
              class="fi"
              type="number"
              :value="blackening.jiaojubuchang"
              @input="updateList('blackeningRecipes', blackening.id, 'jiaojubuchang', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
        <template v-if="blackening && !node.missing">
          <details class="formula-group" open>
            <summary>{{ t('recipes.fieldSaoheikaikou') }}</summary>
            <div class="kb-row">
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="blackening.saoheikaikou?.k ?? 0"
                @update:model-value="updateList('blackeningRecipes', blackening.id, 'saoheikaikou.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="blackening.saoheikaikou?.b ?? 0"
                @update:model-value="updateList('blackeningRecipes', blackening.id, 'saoheikaikou.b', $event)"
              />
            </div>
          </details>
          <div class="field-grid field-grid-top">
            <div class="field">
              <label class="fl">{{ t('recipes.fieldLaser') }}</label>
              <div class="ref-row">
                <div class="select-wrap">
                  <select
                    class="fi"
                    :value="blackening.laserPowerRecipeId"
                    @change="updateList('blackeningRecipes', blackening.id, 'laserPowerRecipeId', ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">{{ t('recipes.pendingSelect') }}</option>
                    <option v-for="l in laserOptions" :key="l.id" :value="l.id">{{ optLabel(l) }}</option>
                  </select>
                  <span class="material-symbols-outlined select-arrow">expand_more</span>
                </div>
                <button type="button" class="ref-create" @click="emit('create-and-link', 'laserPowerRecipeId')">
                  {{ t('recipes.createAndLink') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- machining -->
      <div v-else-if="node.kind === 'machining'" class="rne-panel">
        <div v-if="!machining || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <div v-else class="field-grid">
          <div class="field">
            <label class="fl">{{ t('recipes.fieldHorizontal') }}</label>
            <div class="ref-row">
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="machining.horizontalFormulaId"
                  @change="updateList('machiningRecipes', machining.id, 'horizontalFormulaId', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('recipes.pendingSelect') }}</option>
                  <option v-for="h in horizontalOptions" :key="h.id" :value="h.id">{{ optLabel(h) }}</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              <button type="button" class="ref-create" @click="emit('create-and-link', 'horizontalFormulaId')">
                {{ t('recipes.createAndLink') }}
              </button>
            </div>
          </div>
          <div class="field">
            <label class="fl">{{ t('recipes.fieldVertical') }}</label>
            <div class="ref-row">
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="machining.verticalFormulaId"
                  @change="updateList('machiningRecipes', machining.id, 'verticalFormulaId', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('recipes.pendingSelect') }}</option>
                  <option v-for="v in verticalOptions" :key="v.id" :value="v.id">{{ optLabel(v) }}</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              <button type="button" class="ref-create" @click="emit('create-and-link', 'verticalFormulaId')">
                {{ t('recipes.createAndLink') }}
              </button>
            </div>
          </div>
          <div class="field">
            <label class="fl">{{ t('recipes.fieldLaser') }}</label>
            <div class="ref-row">
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="machining.laserPowerRecipeId"
                  @change="updateList('machiningRecipes', machining.id, 'laserPowerRecipeId', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('recipes.pendingSelect') }}</option>
                  <option v-for="l in laserOptions" :key="l.id" :value="l.id">{{ optLabel(l) }}</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              <button type="button" class="ref-create" @click="emit('create-and-link', 'laserPowerRecipeId')">
                {{ t('recipes.createAndLink') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- horizontal -->
      <div v-else-if="node.kind === 'horizontal'" class="rne-panel">
        <div v-if="!horizontal || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <div class="field-grid field-grid-2col">
            <div class="field">
              <label class="fl">{{ t('recipes.fieldOpeningShape') }}</label>
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="horizontal.openingShape"
                  @change="updateList('horizontalFormulaRecipes', horizontal.id, 'openingShape', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="V型">V型</option>
                  <option value="//型">//型</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div class="field">
              <label class="fl">{{ t('recipes.fieldFocusComp') }}</label>
              <input
                class="fi"
                type="number"
                step="0.01"
                :value="horizontal.focusCompensation"
                @input="updateList('horizontalFormulaRecipes', horizontal.id, 'focusCompensation', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupAngleFormula') }}</summary>
            <div class="kb-row">
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="horizontal.angleFormula?.k ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'angleFormula.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="horizontal.angleFormula?.b ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'angleFormula.b', $event)"
              />
            </div>
          </details>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupLowerOpening') }}</summary>
            <div class="kb-row">
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="horizontal.lowerOpeningFormula?.k ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'lowerOpeningFormula.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="horizontal.lowerOpeningFormula?.b ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'lowerOpeningFormula.b', $event)"
              />
            </div>
          </details>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupDepthComp') }}</summary>
            <div class="kb-row">
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="horizontal.depthCompensationFormula?.k ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'depthCompensationFormula.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="horizontal.depthCompensationFormula?.b ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'depthCompensationFormula.b', $event)"
              />
            </div>
          </details>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupCompAngle') }}</summary>
            <div class="kb-row">
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="horizontal.compensationAngleFormula?.k ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'compensationAngleFormula.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="horizontal.compensationAngleFormula?.b ?? 0"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'compensationAngleFormula.b', $event)"
              />
            </div>
          </details>
        </template>
      </div>

      <!-- vertical -->
      <div v-else-if="node.kind === 'vertical'" class="rne-panel">
        <div v-if="!vertical || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <div class="field-grid">
            <div class="field">
              <label class="fl">{{ t('recipes.fieldCuttingAxis') }}</label>
              <div class="select-wrap">
                <select
                  class="fi"
                  :value="vertical.cuttingAxis"
                  @change="updateList('verticalFormulaRecipes', vertical.id, 'cuttingAxis', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="XY">XY</option>
                  <option value="R">R</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <RecipeUnitValue
              :label="t('recipes.fieldChangePercent')"
              :model-value="vertical.changePercent"
              :unit="t('recipes.unitPercent')"
              @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'changePercent', $event)"
            />
            <RecipeUnitValue
              :label="t('recipes.fieldXFeed')"
              :model-value="vertical.xFeed"
              :unit="t('recipes.unitMm')"
              :step="0.001"
              @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'xFeed', $event)"
            />
            <RecipeUnitValue
              :label="t('recipes.fieldXSpeed')"
              :model-value="vertical.xSpeed"
              :unit="t('recipes.unitMmPerS')"
              @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'xSpeed', $event)"
            />
          </div>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupEdgeCutting') }}</summary>
            <div class="field-grid">
              <RecipeUnitValue
                :label="t('recipes.fieldSpeed')"
                :model-value="vertical.edgeCutting?.speed ?? 0"
                :unit="t('recipes.unitPercent')"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.speed', $event)"
              />
              <div class="field">
                <label class="fl">{{ t('recipes.fieldCutTimes') }}</label>
                <input
                  class="fi"
                  type="number"
                  :value="vertical.edgeCutting?.cutTimes ?? 0"
                  @input="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.cutTimes', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div class="field">
                <label class="fl">{{ t('recipes.fieldCutSpeedNums') }}</label>
                <input
                  class="fi"
                  type="number"
                  :value="vertical.edgeCutting?.cutSpeedNums ?? 0"
                  @input="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.cutSpeedNums', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="vertical.edgeCutting?.change?.k ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.change.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="vertical.edgeCutting?.change?.b ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.change.b', $event)"
              />
            </div>
          </details>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupMiddleCutting') }}</summary>
            <div class="field-grid">
              <RecipeUnitValue
                :label="t('recipes.fieldSpeed')"
                :model-value="vertical.middleCutting?.speed ?? 0"
                :unit="t('recipes.unitPercent')"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'middleCutting.speed', $event)"
              />
              <div class="field">
                <label class="fl">{{ t('recipes.fieldCutTimes') }}</label>
                <input
                  class="fi"
                  type="number"
                  :value="vertical.middleCutting?.cutTimes ?? 0"
                  @input="updateList('verticalFormulaRecipes', vertical.id, 'middleCutting.cutTimes', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="vertical.middleCutting?.change?.k ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'middleCutting.change.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="vertical.middleCutting?.change?.b ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'middleCutting.change.b', $event)"
              />
            </div>
          </details>

          <details class="formula-group" open>
            <summary>{{ t('recipes.groupDescentCutting') }}</summary>
            <div class="field-grid">
              <RecipeUnitValue
                :label="t('recipes.fieldDescentAmount')"
                :model-value="vertical.descentCutting?.speed ?? 0"
                :unit="t('recipes.unitMm')"
                :step="0.001"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'descentCutting.speed', $event)"
              />
              <RecipeUnitValue
                :label="t('recipes.fieldZFeed')"
                :model-value="vertical.descentCutting?.zFeed ?? 0"
                :unit="t('recipes.unitMm')"
                :step="0.001"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'descentCutting.zFeed', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="K"
                :model-value="vertical.descentCutting?.change?.k ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'descentCutting.change.k', $event)"
              />
              <RecipeKbValue
                label=""
                coeff="B"
                :model-value="vertical.descentCutting?.change?.b ?? 0"
                @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'descentCutting.change.b', $event)"
              />
            </div>
          </details>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rne {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-surface-container) 88%, transparent);
  border-radius: 12px;
  border: 1px solid var(--color-outline-variant);
  overflow: hidden;
}
.rne-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}
.rne-head-text { min-width: 0; }
.rne-sub {
  margin: 0 0 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-outline);
}
.rne-crumb {
  margin: 0 0 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rne-crumb-sep { opacity: 0.55; }
.rne-crumb-item.current {
  color: var(--color-primary);
  font-weight: 650;
}
.rne-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--color-on-surface);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rne-title.pending {
  color: var(--color-tertiary);
  font-style: italic;
}
.rne-stepper {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.rne-step {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}
.rne-step .material-symbols-outlined { font-size: 16px; }
.rne-step:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.rne-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: none;
}
.rne-body::-webkit-scrollbar { display: none; }
.rne-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: rne-fade 0.12s ease-out;
}
@keyframes rne-fade {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
.rne-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  color: var(--color-on-surface-variant);
  opacity: 0.55;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}
.rne-empty.pending { color: var(--color-tertiary); opacity: 0.85; }
.rne-empty-icon { font-size: 40px; }
.unit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 18px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 18px;
}
.field-grid-2col { grid-template-columns: 1fr 1fr; }
.field-grid-top { margin-top: 4px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.fl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-left: 2px;
}
.field:focus-within .fl { color: var(--color-primary); opacity: 1; }
.fi {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-surface-container-highest) 60%, transparent);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease;
}
.fi:hover {
  border-color: color-mix(in srgb, var(--color-outline) 60%, transparent);
  background: color-mix(in srgb, var(--color-surface-container-highest) 75%, transparent);
}
.fi:focus {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-surface-container-highest) 80%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent),
    0 0 0 4px color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.fi.mono { font-size: 11px; }
.fi[type='number']::-webkit-outer-spin-button,
.fi[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.fi[type='number'] { appearance: textfield; -moz-appearance: textfield; }
.ref-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.ref-row .select-wrap { flex: 1; min-width: 0; }
.ref-create {
  flex-shrink: 0;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  color: var(--color-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.ref-create:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.select-wrap { position: relative; display: flex; }
.select-wrap > select.fi {
  width: 100%;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 32px;
}
.select-wrap > select.fi option {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}
.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-outline);
  pointer-events: none;
}
.select-wrap:focus-within .select-arrow {
  color: var(--color-primary);
  transform: translateY(-50%) rotate(180deg);
}
.formula-group {
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-container-low) 70%, transparent);
  padding: 0 12px 12px;
}
.formula-group > summary {
  cursor: pointer;
  list-style: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-tertiary);
  padding: 10px 0 8px;
  user-select: none;
}
.formula-group > summary::-webkit-details-marker { display: none; }
.formula-group > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 6px;
  transition: transform 0.12s ease;
}
.formula-group[open] > summary::before { transform: rotate(90deg); }
.kb-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 18px;
}
@media (max-width: 900px) {
  .unit-grid,
  .field-grid { grid-template-columns: 1fr 1fr; }
}
</style>
