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
  'go-to-kind': [kind: 'blackening' | 'machining' | 'laser' | 'horizontal' | 'vertical']
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

function linkedLabel(
  id: string | undefined,
  options: { id: string; name?: string }[]
): string {
  if (!id) return t('recipes.linkedNone')
  const hit = options.find((x) => x.id === id)
  return hit ? optLabel(hit) : t('recipes.linkedMissing')
}

/** 兼容后端/历史数据里 enabled 为布尔或 "true"/"false" 字符串 */
function isEnabledFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function updateList(listKey: string, id: string, fieldPath: string, value: unknown): void {
  emit('update-list-item', listKey, id, fieldPath, value)
}

const blackeningEnabled = computed(() => isEnabledFlag(props.blackening?.enabled))

function setBlackeningEnabled(on: boolean): void {
  const id = props.blackening?.id || (props.node.kind === 'blackening' ? props.node.id : '')
  if (!id) return
  emit('update-list-item', 'blackeningRecipes', id, 'enabled', on)
}

const machiningTeachingMode = computed(() => isEnabledFlag(props.machining?.teachingMode))

function setMachiningTeachingMode(on: boolean): void {
  const id = props.machining?.id || (props.node.kind === 'machining' ? props.node.id : '')
  if (!id) return
  emit('update-list-item', 'machiningRecipes', id, 'teachingMode', on)
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
        <template v-else>
          <!-- 主配方自身属性 -->
          <section class="rne-section tone-main">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">badge</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionMainProps') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionMainPropsDesc') }}</p>
              </div>
            </header>
            <div class="field-grid field-grid-2col">
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
            </div>
          </section>

          <!-- 关联子配方 -->
          <section class="rne-section tone-sub">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">account_tree</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionSubLinks') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionSubLinksDesc') }}</p>
              </div>
            </header>

            <div class="sub-link-grid">
              <article
                class="sub-link-card"
                :class="{ linked: Boolean(main.blackeningRecipeId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-blackening">
                    <span class="material-symbols-outlined">contrast</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeBlackening') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(main.blackeningRecipeId, blackeningOptions) }}
                    </span>
                  </div>
                </div>
                <div class="ref-row">
                  <div class="select-wrap">
                    <select
                      class="fi"
                      :value="main.blackeningRecipeId"
                      @change="emit('update-main', 'blackeningRecipeId', ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">{{ t('recipes.pendingSelect') }}</option>
                      <option v-for="b in blackeningOptions" :key="b.id" :value="b.id">
                        {{ optLabel(b) }}
                      </option>
                    </select>
                    <span class="material-symbols-outlined select-arrow">expand_more</span>
                  </div>
                  <button
                    type="button"
                    class="ref-create"
                    @click="emit('create-and-link', 'blackeningRecipeId')"
                  >
                    {{ t('recipes.createAndLink') }}
                  </button>
                </div>
                <button
                  type="button"
                  class="sub-link-open"
                  :disabled="!main.blackeningRecipeId"
                  @click="emit('go-to-kind', 'blackening')"
                >
                  <span class="material-symbols-outlined">arrow_forward</span>
                  {{ t('recipes.editLinkedSub') }}
                </button>
              </article>

              <article
                class="sub-link-card"
                :class="{ linked: Boolean(main.machiningRecipeId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-machining">
                    <span class="material-symbols-outlined">precision_manufacturing</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeMachining') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(main.machiningRecipeId, machiningOptions) }}
                    </span>
                  </div>
                </div>
                <div class="ref-row">
                  <div class="select-wrap">
                    <select
                      class="fi"
                      :value="main.machiningRecipeId"
                      @change="emit('update-main', 'machiningRecipeId', ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">{{ t('recipes.pendingSelect') }}</option>
                      <option v-for="m in machiningOptions" :key="m.id" :value="m.id">
                        {{ optLabel(m) }}
                      </option>
                    </select>
                    <span class="material-symbols-outlined select-arrow">expand_more</span>
                  </div>
                  <button
                    type="button"
                    class="ref-create"
                    @click="emit('create-and-link', 'machiningRecipeId')"
                  >
                    {{ t('recipes.createAndLink') }}
                  </button>
                </div>
                <button
                  type="button"
                  class="sub-link-open"
                  :disabled="!main.machiningRecipeId"
                  @click="emit('go-to-kind', 'machining')"
                >
                  <span class="material-symbols-outlined">arrow_forward</span>
                  {{ t('recipes.editLinkedSub') }}
                </button>
              </article>
            </div>
          </section>
        </template>
      </div>

      <!-- laser -->
      <div v-else-if="node.kind === 'laser'" class="rne-panel">
        <div v-if="!laser || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <section class="rne-section tone-params">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">bolt</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionLaserParams') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionLaserParamsDesc') }}</p>
              </div>
            </header>
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
          </section>
        </template>
      </div>

      <!-- blackening -->
      <div v-else-if="node.kind === 'blackening'" class="rne-panel">
        <div v-if="!blackening || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <section
            class="rne-section tone-enable"
            :class="{ 'is-on': blackeningEnabled, 'is-off': !blackeningEnabled }"
          >
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">
                  {{ blackeningEnabled ? 'toggle_on' : 'toggle_off' }}
                </span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionEnabled') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionEnabledDesc') }}</p>
              </div>
            </header>
            <div class="enable-toggle" role="group" :aria-label="t('recipes.fieldEnabled')">
              <button
                type="button"
                class="enable-btn"
                :class="{ active: blackeningEnabled }"
                @click="setBlackeningEnabled(true)"
              >
                {{ t('recipes.fieldYes') }}
              </button>
              <button
                type="button"
                class="enable-btn"
                :class="{ active: !blackeningEnabled }"
                @click="setBlackeningEnabled(false)"
              >
                {{ t('recipes.fieldNo') }}
              </button>
            </div>
          </section>

          <section class="rne-section tone-params">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">tune</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionBlackeningParams') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionBlackeningParamsDesc') }}</p>
              </div>
            </header>
            <div class="field-grid">
              <RecipeUnitValue
                :label="t('recipes.fieldDescentStep')"
                :model-value="blackening.descentStep"
                :unit="t('recipes.unitMm')"
                :step="0.01"
                @update:model-value="updateList('blackeningRecipes', blackening.id, 'descentStep', $event)"
              />
              <RecipeUnitValue
                :label="t('recipes.fieldDescentCount')"
                :model-value="blackening.descentCount"
                :unit="t('recipes.unitTimes')"
                :step="1"
                @update:model-value="updateList('blackeningRecipes', blackening.id, 'descentCount', $event)"
              />
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
              <RecipeUnitValue
                :label="t('recipes.fieldJiaojubuchang')"
                :model-value="blackening.jiaojubuchang"
                :unit="t('recipes.unitUm')"
                :step="1"
                @update:model-value="updateList('blackeningRecipes', blackening.id, 'jiaojubuchang', $event)"
              />
            </div>
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
          </section>

          <section class="rne-section tone-sub">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">account_tree</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionSubLinks') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionBlackeningLinksDesc') }}</p>
              </div>
            </header>
            <div class="sub-link-grid sub-link-grid-1">
              <article
                class="sub-link-card"
                :class="{ linked: Boolean(blackening.laserPowerRecipeId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-laser">
                    <span class="material-symbols-outlined">bolt</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeLaser') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(blackening.laserPowerRecipeId, laserOptions) }}
                    </span>
                  </div>
                </div>
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
              </article>
            </div>
          </section>
        </template>
      </div>

      <!-- machining -->
      <div v-else-if="node.kind === 'machining'" class="rne-panel">
        <div v-if="!machining || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <section
            class="rne-section tone-enable"
            :class="{ 'is-on': machiningTeachingMode, 'is-off': !machiningTeachingMode }"
          >
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">
                  {{ machiningTeachingMode ? 'toggle_on' : 'toggle_off' }}
                </span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.fieldTeachingMode') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionTeachingModeDesc') }}</p>
              </div>
            </header>
            <div class="enable-toggle" role="group" :aria-label="t('recipes.fieldTeachingMode')">
              <button
                type="button"
                class="enable-btn"
                :class="{ active: machiningTeachingMode }"
                @click="setMachiningTeachingMode(true)"
              >
                {{ t('recipes.fieldYes') }}
              </button>
              <button
                type="button"
                class="enable-btn"
                :class="{ active: !machiningTeachingMode }"
                @click="setMachiningTeachingMode(false)"
              >
                {{ t('recipes.fieldNo') }}
              </button>
            </div>
          </section>

          <section class="rne-section tone-sub">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">account_tree</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionSubLinks') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionMachiningLinksDesc') }}</p>
              </div>
            </header>
            <div class="sub-link-grid sub-link-grid-3">
              <article
                class="sub-link-card"
                :class="{ linked: Boolean(machining.horizontalFormulaId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-horizontal">
                    <span class="material-symbols-outlined">horizontal_rule</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeHorizontal') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(machining.horizontalFormulaId, horizontalOptions) }}
                    </span>
                  </div>
                </div>
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
                <button
                  type="button"
                  class="sub-link-open"
                  :disabled="!machining.horizontalFormulaId"
                  @click="emit('go-to-kind', 'horizontal')"
                >
                  <span class="material-symbols-outlined">arrow_forward</span>
                  {{ t('recipes.editLinkedSub') }}
                </button>
              </article>

              <article
                class="sub-link-card"
                :class="{ linked: Boolean(machining.verticalFormulaId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-vertical">
                    <span class="material-symbols-outlined">height</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeVertical') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(machining.verticalFormulaId, verticalOptions) }}
                    </span>
                  </div>
                </div>
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
                <button
                  type="button"
                  class="sub-link-open"
                  :disabled="!machining.verticalFormulaId"
                  @click="emit('go-to-kind', 'vertical')"
                >
                  <span class="material-symbols-outlined">arrow_forward</span>
                  {{ t('recipes.editLinkedSub') }}
                </button>
              </article>

              <article
                class="sub-link-card"
                :class="{ linked: Boolean(machining.laserPowerRecipeId) }"
              >
                <div class="sub-link-top">
                  <span class="sub-link-icon tone-laser">
                    <span class="material-symbols-outlined">bolt</span>
                  </span>
                  <div class="sub-link-meta">
                    <span class="sub-link-kind">{{ t('recipes.typeLaser') }}</span>
                    <span class="sub-link-current">
                      {{ linkedLabel(machining.laserPowerRecipeId, laserOptions) }}
                    </span>
                  </div>
                </div>
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
                <button
                  type="button"
                  class="sub-link-open"
                  :disabled="!machining.laserPowerRecipeId"
                  @click="emit('go-to-kind', 'laser')"
                >
                  <span class="material-symbols-outlined">arrow_forward</span>
                  {{ t('recipes.editLinkedSub') }}
                </button>
              </article>
            </div>
          </section>
        </template>
      </div>

      <!-- horizontal -->
      <div v-else-if="node.kind === 'horizontal'" class="rne-panel">
        <div v-if="!horizontal || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <section class="rne-section tone-params">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">horizontal_rule</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionHorizontalParams') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionHorizontalParamsDesc') }}</p>
              </div>
            </header>
            <div class="field-grid field-grid-2col">
              <div class="field">
                <label class="fl">{{ t('recipes.fieldOpeningShape') }}</label>
                <div
                  class="enable-toggle"
                  role="group"
                  :aria-label="t('recipes.fieldOpeningShape')"
                >
                  <button
                    type="button"
                    class="enable-btn"
                    :class="{ active: horizontal.openingShape === 'V型' }"
                    @click="updateList('horizontalFormulaRecipes', horizontal.id, 'openingShape', 'V型')"
                  >
                    V型
                  </button>
                  <button
                    type="button"
                    class="enable-btn"
                    :class="{ active: horizontal.openingShape === '//型' }"
                    @click="updateList('horizontalFormulaRecipes', horizontal.id, 'openingShape', '//型')"
                  >
                    //型
                  </button>
                </div>
              </div>
              <RecipeUnitValue
                :label="t('recipes.fieldFocusComp')"
                :model-value="horizontal.focusCompensation"
                :unit="t('recipes.unitMm')"
                :step="0.01"
                @update:model-value="updateList('horizontalFormulaRecipes', horizontal.id, 'focusCompensation', $event)"
              />
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
          </section>
        </template>
      </div>

      <!-- vertical -->
      <div v-else-if="node.kind === 'vertical'" class="rne-panel">
        <div v-if="!vertical || node.missing" class="rne-empty pending">
          <span class="material-symbols-outlined rne-empty-icon">pending</span>
          <span>{{ t('recipes.pendingSelect') }}</span>
        </div>
        <template v-else>
          <section class="rne-section tone-params">
            <header class="rne-section-head">
              <span class="rne-section-badge">
                <span class="material-symbols-outlined">height</span>
              </span>
              <div class="rne-section-text">
                <h3 class="rne-section-title">{{ t('recipes.sectionVerticalParams') }}</h3>
                <p class="rne-section-desc">{{ t('recipes.sectionVerticalParamsDesc') }}</p>
              </div>
            </header>
            <div class="field">
              <label class="fl">{{ t('recipes.fieldCuttingAxis') }}</label>
              <div
                class="enable-toggle"
                role="group"
                :aria-label="t('recipes.fieldCuttingAxis')"
              >
                <button
                  type="button"
                  class="enable-btn"
                  :class="{ active: vertical.cuttingAxis === 'XY' }"
                  @click="updateList('verticalFormulaRecipes', vertical.id, 'cuttingAxis', 'XY')"
                >
                  XY
                </button>
                <button
                  type="button"
                  class="enable-btn"
                  :class="{ active: vertical.cuttingAxis === 'R' }"
                  @click="updateList('verticalFormulaRecipes', vertical.id, 'cuttingAxis', 'R')"
                >
                  R
                </button>
              </div>
            </div>
            <div class="field-grid field-grid-top">
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
                <RecipeUnitValue
                  :label="t('recipes.fieldCutTimes')"
                  :model-value="vertical.edgeCutting?.cutTimes ?? 0"
                  :unit="t('recipes.unitTimes')"
                  :step="1"
                  @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.cutTimes', $event)"
                />
                <RecipeUnitValue
                  :label="t('recipes.fieldCutSpeedNums')"
                  :model-value="vertical.edgeCutting?.cutSpeedNums ?? 0"
                  :unit="t('recipes.unitTimes')"
                  :step="1"
                  @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'edgeCutting.cutSpeedNums', $event)"
                />
              </div>
              <div class="kb-row">
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
                <RecipeUnitValue
                  :label="t('recipes.fieldCutTimes')"
                  :model-value="vertical.middleCutting?.cutTimes ?? 0"
                  :unit="t('recipes.unitTimes')"
                  :step="1"
                  @update:model-value="updateList('verticalFormulaRecipes', vertical.id, 'middleCutting.cutTimes', $event)"
                />
              </div>
              <div class="kb-row">
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
              </div>
              <div class="kb-row">
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
          </section>
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
  gap: 16px;
  animation: rne-fade 0.12s ease-out;
}

.rne-section {
  --sec-accent: var(--color-primary);
  padding: 14px 16px 16px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--sec-accent) 22%, rgba(255, 255, 255, 0.08));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--sec-accent) 9%, transparent), transparent 52%),
    rgba(20, 22, 26, 0.45);
}
.rne-section.tone-main { --sec-accent: #7eb6ff; }
.rne-section.tone-sub { --sec-accent: #5eead4; }
.rne-section.tone-params { --sec-accent: #fbbf24; }
.rne-section.tone-enable { --sec-accent: #86efac; }
.rne-section.tone-enable.is-off { --sec-accent: #94a3b8; }
.rne-section.tone-enable .rne-section-head {
  align-items: center;
  margin-bottom: 12px;
}
.rne-section.tone-enable .rne-section-text {
  flex: 1;
  min-width: 0;
}

.enable-toggle {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  padding: 3px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  gap: 3px;
  pointer-events: auto;
}
.enable-btn {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  transition: background 0.12s ease, color 0.12s ease;
}
.enable-btn.active {
  background: color-mix(in srgb, var(--sec-accent) 28%, transparent);
  color: var(--sec-accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sec-accent) 45%, transparent);
}
.enable-btn:hover:not(.active) {
  color: var(--color-on-surface);
  background: rgba(255, 255, 255, 0.04);
}

.sub-link-grid-1 { grid-template-columns: 1fr; }
.sub-link-grid-3 { grid-template-columns: repeat(3, 1fr); }
.sub-link-icon.tone-laser {
  color: #7dd3fc;
  background: rgba(125, 211, 252, 0.12);
  border-color: rgba(125, 211, 252, 0.28);
}
.sub-link-icon.tone-horizontal {
  color: #f9a8d4;
  background: rgba(249, 168, 212, 0.12);
  border-color: rgba(249, 168, 212, 0.28);
}
.sub-link-icon.tone-vertical {
  color: #86efac;
  background: rgba(134, 239, 172, 0.12);
  border-color: rgba(134, 239, 172, 0.28);
}

.rne-section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.rne-section-badge {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--sec-accent);
  background: color-mix(in srgb, var(--sec-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--sec-accent) 32%, transparent);
}
.rne-section-badge .material-symbols-outlined { font-size: 18px; }
.rne-section-text { min-width: 0; }
.rne-section-title {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface);
}
.rne-section-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-on-surface-variant);
}

.sub-link-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sub-link-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.sub-link-card.linked {
  border-color: color-mix(in srgb, var(--sec-accent) 35%, transparent);
  background: color-mix(in srgb, var(--sec-accent) 6%, rgba(0, 0, 0, 0.18));
}
.sub-link-top {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.sub-link-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.sub-link-icon .material-symbols-outlined { font-size: 18px; }
.sub-link-icon.tone-blackening {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.28);
}
.sub-link-icon.tone-machining {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.28);
}
.sub-link-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sub-link-kind {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface);
}
.sub-link-current {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub-link-card.linked .sub-link-current {
  color: var(--sec-accent);
  font-weight: 600;
}
.sub-link-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px dashed color-mix(in srgb, var(--sec-accent) 40%, transparent);
  background: transparent;
  color: var(--sec-accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}
.sub-link-open .material-symbols-outlined { font-size: 16px; }
.sub-link-open:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sec-accent) 12%, transparent);
  border-style: solid;
}
.sub-link-open:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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
  margin-top: 14px;
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
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .sub-link-grid-3 { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .unit-grid,
  .field-grid { grid-template-columns: 1fr 1fr; }
  .sub-link-grid { grid-template-columns: 1fr; }
}
</style>
