<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useL10n } from '../shared/l10n'
import {
  useRecipes,
  buildRecipeChain,
  chainStep,
  chainIndexOf,
  findRecipeReferrers,
  SubRecipeDefaults,
  listKeyBySubType
} from '../shared/recipe'
import type {
  MainRecipe,
  RecipeStatePayload,
  RecipeChainNode,
  RecipeChainKind,
  RecipeReferrer,
  LaserPowerRecipe,
  BlackeningRecipe,
  MachiningRecipe,
  HorizontalFormulaRecipe,
  VerticalFormulaRecipe
} from '../shared/recipe'
import RecipesTopBar from '../shared/components/recipes/RecipesTopBar.vue'
import RecipesMainList from '../shared/components/recipes/RecipesMainList.vue'
import RecipesChainNav from '../shared/components/recipes/RecipesChainNav.vue'
import RecipesLibraryNav from '../shared/components/recipes/RecipesLibraryNav.vue'
import type { LibraryType } from '../shared/components/recipes/RecipesLibraryNav.vue'
import RecipesLibraryList from '../shared/components/recipes/RecipesLibraryList.vue'
import RecipesNodeEditor from '../shared/components/recipes/RecipesNodeEditor.vue'

type PageMode = 'flow' | 'library'

const { t } = useL10n()
const {
  state,
  mainRecipes,
  selectedMainRecipeId,
  selectedRecipe,
  loading,
  dirty,
  lastError,
  load,
  save,
  selectRecipe,
  updateField,
  replaceList,
  updateListItem
} = useRecipes()

const pageMode = ref<PageMode>('flow')
const chainIndex = ref(0)
const libraryType = ref<LibraryType>('laser')
const librarySelectedId = ref<string | null>(null)
const sidebarSearch = ref('')
const statusMsg = ref('')

const showNewDialog = ref(false)
const newRecipeName = ref('')
const renameDlgType = ref<LibraryType | ''>('')
const renameDlgId = ref('')
const renameDlgName = ref('')
const showDeleteRefDialog = ref(false)
const deleteReferrers = ref<RecipeReferrer[]>([])
const pendingDelete = ref<{ listKey: string; id: string } | null>(null)

const recipeState = computed(() => state.value as RecipeStatePayload)

const chainNodes = computed(() => buildRecipeChain(recipeState.value, selectedRecipe.value))

watch(chainNodes, (nodes) => {
  if (chainIndex.value >= nodes.length) {
    chainIndex.value = Math.max(0, nodes.length - 1)
  }
})

const laserList = computed(() => (recipeState.value.laserPowerRecipes ?? []) as LaserPowerRecipe[])
const blackeningList = computed(
  () => (recipeState.value.blackeningRecipes ?? []) as BlackeningRecipe[]
)
const machiningList = computed(
  () => (recipeState.value.machiningRecipes ?? []) as MachiningRecipe[]
)
const horizontalList = computed(
  () => (recipeState.value.horizontalFormulaRecipes ?? []) as HorizontalFormulaRecipe[]
)
const verticalList = computed(
  () => (recipeState.value.verticalFormulaRecipes ?? []) as VerticalFormulaRecipe[]
)

const libraryCounts = computed<Record<LibraryType, number>>(() => ({
  laser: laserList.value.length,
  blackening: blackeningList.value.length,
  machining: machiningList.value.length,
  horizontal: horizontalList.value.length,
  vertical: verticalList.value.length
}))

type LibraryItem = { id: string; name?: string }

const libraryItems = computed<LibraryItem[]>(() => {
  switch (libraryType.value) {
    case 'laser':
      return laserList.value
    case 'blackening':
      return blackeningList.value
    case 'machining':
      return machiningList.value
    case 'horizontal':
      return horizontalList.value
    case 'vertical':
      return verticalList.value
    default:
      return []
  }
})

function findById<T extends { id: string }>(
  list: readonly T[] | undefined,
  id: string
): T | undefined {
  return list?.find((x) => x.id === id)
}

const activeFlowNode = computed(
  () => chainNodes.value[chainIndex.value] as RecipeChainNode | undefined
)

const flowBreadcrumb = computed(() => {
  const nodes = chainNodes.value
  const active = nodes[chainIndex.value]
  if (!active) return [t('recipes.modeFlow')]

  const byKind = (kind: RecipeChainKind): RecipeChainNode | undefined =>
    nodes.find((n) => n.kind === kind)

  const labelOf = (n: RecipeChainNode | undefined): string =>
    n?.label?.trim() || t('recipes.pendingSelect')

  const main = byKind('main')
  const machining = byKind('machining')
  const path: (RecipeChainNode | undefined)[] = []
  switch (active.kind) {
    case 'main':
      path.push(active)
      break
    case 'blackening':
      path.push(main, active)
      break
    case 'machining':
      path.push(main, active)
      break
    case 'laser':
    case 'horizontal':
    case 'vertical':
      path.push(main, machining, active)
      break
  }
  return [t('recipes.modeFlow'), ...path.map(labelOf)]
})

const referrerTypeKey: Record<RecipeReferrer['listKey'], string> = {
  mainRecipes: 'recipes.typeMain',
  machiningRecipes: 'recipes.typeMachining',
  blackeningRecipes: 'recipes.typeBlackening'
}

function referrerTypeLabel(listKey: RecipeReferrer['listKey']): string {
  return t(referrerTypeKey[listKey])
}

const libraryNode = computed<RecipeChainNode>(() => {
  const id = librarySelectedId.value ?? ''
  const item = id ? findById(libraryItems.value, id) : undefined
  const label = item ? item.name?.trim() || item.id : ''
  return {
    kind: libraryType.value,
    id,
    label,
    depth: 0,
    missing: !item
  }
})

const editorNode = computed(() =>
  pageMode.value === 'flow' ? activeFlowNode.value : libraryNode.value
)

const editorMain = computed(() => {
  if (pageMode.value === 'flow' && activeFlowNode.value?.kind === 'main') {
    return selectedRecipe.value
  }
  return undefined
})

const editorLaser = computed(() => {
  const node = editorNode.value
  if (!node || node.kind !== 'laser' || !node.id) return undefined
  return findById(laserList.value, node.id)
})

const editorBlackening = computed(() => {
  const node = editorNode.value
  if (!node || node.kind !== 'blackening' || !node.id) return undefined
  return findById(blackeningList.value, node.id)
})

const editorMachining = computed(() => {
  const node = editorNode.value
  if (!node || node.kind !== 'machining' || !node.id) return undefined
  return findById(machiningList.value, node.id)
})

const editorHorizontal = computed(() => {
  const node = editorNode.value
  if (!node || node.kind !== 'horizontal' || !node.id) return undefined
  return findById(horizontalList.value, node.id)
})

const editorVertical = computed(() => {
  const node = editorNode.value
  if (!node || node.kind !== 'vertical' || !node.id) return undefined
  return findById(verticalList.value, node.id)
})

function seedLibrarySelection(): void {
  librarySelectedId.value = libraryItems.value[0]?.id ?? null
}

function handleSelectMain(id: string): void {
  selectRecipe(id)
  chainIndex.value = 0
}

function handleUpdateMain(key: keyof MainRecipe, value: string): void {
  const id = selectedMainRecipeId.value
  if (!id) return
  const arr = mainRecipes.value.map((r) => (r.id === id ? { ...r, [key]: value } : r))
  updateField('mainRecipes', arr)
}

function handleUpdateListItem(
  listKey: string,
  id: string,
  fieldPath: string,
  value: unknown
): void {
  updateListItem(listKey, id, fieldPath, value)
}

type CreateAndLinkTarget =
  | 'blackeningRecipeId'
  | 'machiningRecipeId'
  | 'laserPowerRecipeId'
  | 'horizontalFormulaId'
  | 'verticalFormulaId'

const createLinkMeta: Record<
  CreateAndLinkTarget,
  { subType: string; chainKind: RecipeChainKind }
> = {
  blackeningRecipeId: { subType: 'blackening', chainKind: 'blackening' },
  machiningRecipeId: { subType: 'machining', chainKind: 'machining' },
  laserPowerRecipeId: { subType: 'laser', chainKind: 'laser' },
  horizontalFormulaId: { subType: 'horizontal', chainKind: 'horizontal' },
  verticalFormulaId: { subType: 'vertical', chainKind: 'vertical' }
}

function handleCreateAndLink(target: CreateAndLinkTarget): void {
  const meta = createLinkMeta[target]
  const listKey = listKeyBySubType[meta.subType]
  if (!listKey) return

  const id = `${meta.subType}-${Date.now()}`
  const defaults = SubRecipeDefaults[meta.subType] ?? {}
  const current = ((recipeState.value[listKey] as { id: string }[] | undefined) ?? [])
  replaceList(listKey, [...current, { id, ...defaults }])

  if (target === 'blackeningRecipeId' || target === 'machiningRecipeId') {
    const main = editorMain.value ?? selectedRecipe.value
    if (!main) return
    updateListItem('mainRecipes', main.id, target, id)
  } else if (
    target === 'laserPowerRecipeId' &&
    editorNode.value?.kind === 'blackening' &&
    editorBlackening.value
  ) {
    updateListItem('blackeningRecipes', editorBlackening.value.id, target, id)
  } else if (editorMachining.value) {
    updateListItem('machiningRecipes', editorMachining.value.id, target, id)
  }

  if (pageMode.value === 'flow') {
    const idx = chainIndexOf(chainNodes.value, meta.chainKind, id)
    if (idx >= 0) chainIndex.value = idx
  }
}

function handlePrev(): void {
  chainIndex.value = chainStep(chainNodes.value, chainIndex.value, -1)
}

function handleNext(): void {
  chainIndex.value = chainStep(chainNodes.value, chainIndex.value, 1)
}

function handleNewMain(): void {
  newRecipeName.value = ''
  showNewDialog.value = true
}

function confirmNewMain(): void {
  const name = newRecipeName.value.trim() || t('recipes.newMain')
  const id = `main-${Date.now()}`
  const m: MainRecipe = {
    id,
    name,
    status: 'draft',
    blackeningRecipeId: '',
    machiningRecipeId: ''
  }
  replaceList('mainRecipes', [...mainRecipes.value, m])
  selectRecipe(id)
  chainIndex.value = 0
  showNewDialog.value = false
}

function handleCloneMain(): void {
  const src = selectedRecipe.value
  if (!src) return
  const id = `main-${Date.now()}`
  const clone: MainRecipe = {
    ...src,
    id,
    name: src.name + t('recipes.cloneSuffix'),
    status: 'draft'
  }
  replaceList('mainRecipes', [...mainRecipes.value, clone])
  selectRecipe(id)
  chainIndex.value = 0
}

function handleDeleteMain(): void {
  const id = selectedMainRecipeId.value
  if (!id) return
  const arr = mainRecipes.value.filter((r) => r.id !== id)
  replaceList('mainRecipes', arr)
  selectRecipe(arr[0]?.id ?? '')
  chainIndex.value = 0
}

function handleSelectLibraryType(type: LibraryType): void {
  libraryType.value = type
  seedLibrarySelection()
}

function handleNewSub(): void {
  const type = libraryType.value
  const listKey = listKeyBySubType[type]
  if (!listKey) return
  const id = `${type}-${Date.now()}`
  const defaults = SubRecipeDefaults[type] ?? {}
  const empty = { id, ...defaults }
  const arr = [...(libraryItems.value as { id: string }[]), empty]
  replaceList(listKey, arr)
  librarySelectedId.value = id
}

function doDeleteSub(listKey: string, id: string): void {
  const current = ((recipeState.value[listKey] as { id: string }[] | undefined) ?? []).filter(
    (r) => r.id !== id
  )
  replaceList(listKey, current)
  if (librarySelectedId.value === id) {
    librarySelectedId.value = current[0]?.id ?? null
  }
}

function handleDeleteSub(): void {
  const id = librarySelectedId.value
  if (!id) return
  const listKey = listKeyBySubType[libraryType.value]
  if (!listKey) return
  const refs = findRecipeReferrers(recipeState.value, { listKey, id })
  if (refs.length > 0) {
    deleteReferrers.value = refs
    pendingDelete.value = { listKey, id }
    showDeleteRefDialog.value = true
    return
  }
  doDeleteSub(listKey, id)
}

function confirmDeleteReferenced(): void {
  if (pendingDelete.value) {
    doDeleteSub(pendingDelete.value.listKey, pendingDelete.value.id)
  }
  showDeleteRefDialog.value = false
  pendingDelete.value = null
  deleteReferrers.value = []
}

function openRenameDialog(id: string): void {
  renameDlgType.value = libraryType.value
  renameDlgId.value = id
  const item = findById(libraryItems.value, id)
  renameDlgName.value = item?.name ?? item?.id ?? ''
}

function confirmRename(): void {
  const type = renameDlgType.value
  const id = renameDlgId.value
  if (!type || !id) return
  const listKey = listKeyBySubType[type]
  if (!listKey) return
  updateListItem(listKey, id, 'name', renameDlgName.value)
  renameDlgType.value = ''
  renameDlgId.value = ''
}

async function handleSave(): Promise<void> {
  statusMsg.value = t('settings.saving')
  await save()
  statusMsg.value = lastError.value
    ? `${t('settings.saveFailed')}: ${lastError.value}`
    : t('recipes.saved')
  if (!lastError.value) {
    setTimeout(() => {
      statusMsg.value = ''
    }, 2000)
  }
}

onMounted(async () => {
  await load()
  if (mainRecipes.value.length > 0 && !selectedMainRecipeId.value) {
    selectRecipe(mainRecipes.value[0].id)
  }
  seedLibrarySelection()
})
</script>

<template>
  <div class="recipes-page">
    <Teleport to="body">
      <div v-if="showNewDialog" class="dlg-overlay" @click.self="showNewDialog = false">
        <div class="dlg-card">
          <span class="dlg-title">{{ t('recipes.newMain') }}</span>
          <input
            v-model="newRecipeName"
            class="dlg-input"
            :placeholder="t('recipes.recipeNamePlaceholder')"
            autofocus
            @keydown.enter="confirmNewMain"
          />
          <div class="dlg-btns">
            <button type="button" class="dlg-ok" @click="confirmNewMain">
              {{ t('recipes.confirm') }}
            </button>
            <button type="button" class="dlg-cancel" @click="showNewDialog = false">
              {{ t('recipes.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="renameDlgType" class="dlg-overlay" @click.self="renameDlgType = ''">
        <div class="dlg-card">
          <span class="dlg-title">{{ t('recipes.rename') }}</span>
          <input
            v-model="renameDlgName"
            class="dlg-input"
            autofocus
            @keydown.enter="confirmRename"
          />
          <div class="dlg-btns">
            <button type="button" class="dlg-ok" @click="confirmRename">
              {{ t('recipes.confirm') }}
            </button>
            <button type="button" class="dlg-cancel" @click="renameDlgType = ''">
              {{ t('recipes.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showDeleteRefDialog" class="dlg-overlay" @click.self="showDeleteRefDialog = false">
        <div class="dlg-card">
          <span class="dlg-title">{{ t('recipes.deleteReferencedTitle') }}</span>
          <p class="dlg-body">{{ t('recipes.deleteReferencedBody') }}</p>
          <ul class="dlg-refs">
            <li v-for="r in deleteReferrers" :key="`${r.listKey}-${r.id}`">
              {{ r.name || r.id }}
              <span class="dlg-ref-meta">{{ referrerTypeLabel(r.listKey) }}</span>
            </li>
          </ul>
          <div class="dlg-btns">
            <button type="button" class="dlg-ok danger" @click="confirmDeleteReferenced">
              {{ t('recipes.delete') }}
            </button>
            <button type="button" class="dlg-cancel" @click="showDeleteRefDialog = false">
              {{ t('recipes.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <RecipesTopBar
      v-model:mode="pageMode"
      :dirty="dirty"
      :saving-hint="statusMsg"
      @save="handleSave"
    />

    <div v-if="pageMode === 'flow'" class="recipes-body">
      <RecipesMainList
        class="col-main"
        :recipes="mainRecipes"
        :selected-id="selectedMainRecipeId"
        :search="sidebarSearch"
        :loading="loading"
        @update:search="sidebarSearch = $event"
        @select="handleSelectMain"
        @new="handleNewMain"
        @clone="handleCloneMain"
        @delete="handleDeleteMain"
      />
      <RecipesChainNav
        class="col-chain"
        :nodes="chainNodes"
        :active-index="chainIndex"
        @select-index="chainIndex = $event"
      />
      <RecipesNodeEditor
        v-if="editorNode"
        class="col-editor"
        :node="editorNode"
        :state="recipeState"
        :main="editorMain"
        :laser="editorLaser"
        :blackening="editorBlackening"
        :machining="editorMachining"
        :horizontal="editorHorizontal"
        :vertical="editorVertical"
        :show-stepper="true"
        :breadcrumb="flowBreadcrumb"
        @update-main="handleUpdateMain"
        @update-list-item="handleUpdateListItem"
        @create-and-link="handleCreateAndLink"
        @prev="handlePrev"
        @next="handleNext"
      />
      <div v-else class="col-editor recipes-empty">
        <span class="material-symbols-outlined">edit_note</span>
        <span>{{ t('recipes.selectOrCreate') }}</span>
      </div>
    </div>

    <div v-else class="recipes-body">
      <RecipesLibraryNav
        class="col-lib-nav"
        :selected-type="libraryType"
        :counts="libraryCounts"
        @select-type="handleSelectLibraryType"
      />
      <RecipesLibraryList
        class="col-lib-list"
        :type="libraryType"
        :items="libraryItems"
        :selected-id="librarySelectedId"
        @select="librarySelectedId = $event"
        @new="handleNewSub"
        @delete="handleDeleteSub"
        @rename="openRenameDialog"
      />
      <RecipesNodeEditor
        v-if="editorNode"
        class="col-editor"
        :node="editorNode"
        :state="recipeState"
        :laser="editorLaser"
        :blackening="editorBlackening"
        :machining="editorMachining"
        :horizontal="editorHorizontal"
        :vertical="editorVertical"
        :show-stepper="false"
        @update-list-item="handleUpdateListItem"
        @create-and-link="handleCreateAndLink"
      />
    </div>
  </div>
</template>

<style scoped>
.recipes-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}

.recipes-body {
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}

.col-main {
  width: 240px;
  flex-shrink: 0;
}

.col-chain {
  width: 200px;
  flex-shrink: 0;
}

.col-lib-nav {
  width: 180px;
  flex-shrink: 0;
}

.col-lib-list {
  width: 240px;
  flex-shrink: 0;
}

.col-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.recipes-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--color-on-surface-variant);
  opacity: 0.55;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}

.recipes-empty .material-symbols-outlined {
  font-size: 44px;
}

.dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dlg-card {
  background: color-mix(in srgb, var(--color-surface-container-highest) 80%, transparent);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 320px;
  max-width: 440px;
  box-shadow:
    0 24px 60px -16px rgba(0, 0, 0, 0.55),
    0 0 0 1px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.dlg-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.dlg-body {
  margin: 0;
  font-size: 13px;
  color: var(--color-on-surface-variant);
  line-height: 1.45;
}

.dlg-refs {
  margin: 0;
  padding: 0 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  color: var(--color-on-surface);
  font-size: 13px;
}

.dlg-ref-meta {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
  margin-top: 2px;
}

.dlg-input {
  padding: 10px 14px;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 80%, transparent);
  border-radius: 6px;
  color: var(--color-on-surface);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.25s ease,
    background 0.2s ease;
}

.dlg-input:hover {
  border-color: color-mix(in srgb, var(--color-outline) 60%, transparent);
}

.dlg-input:focus {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent),
    0 0 0 4px color-mix(in srgb, var(--color-primary) 12%, transparent),
    0 0 18px 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.dlg-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dlg-ok {
  padding: 6px 20px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dlg-ok.danger {
  background: var(--color-error);
  color: var(--color-on-error, #fff);
}

.dlg-cancel {
  padding: 6px 20px;
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  cursor: pointer;
}
</style>
