<script setup lang="ts">
import SvgIcon from '../components/ui/SvgIcon.vue'
import RecipeDetailFieldPanel from '../features/recipe/RecipeDetailFieldPanel.vue'
import RecipeLibrarySection from '../features/recipe/RecipeLibrarySection.vue'
import RecipeEditorCard from '../features/recipe/RecipeEditorCard.vue'
import RecipeTopologyDiagram from '../features/recipe/RecipeTopologyDiagram.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRecipeManagementPage } from '../composables/useSettingsPages'
import { useNotification } from '../composables/useNotification'
import { useRecipeSettingsStore } from '../stores/recipeSettingsStore'
import type {
  LaserPowerRecipe,
  LaserTransmissionMode,
  OpeningShape,
  ProcessFormulaRecipe,
  RecipeStatus,
  VerticalProcessFormulaRecipe
} from '../types/settings'
import { cloneSettings, formatSettingValue } from '../utils/settings'

type ChildRecipeType = 'blackening' | 'machining'
type EditorPanel =
  | 'main'
  | 'blackening'
  | 'machining'
  | 'laserPower'
  | 'horizontal'
  | 'vertical'
type FormulaType = 'horizontal' | 'vertical'

const recipeStore = useRecipeSettingsStore()
const { recipeState, sections } = useRecipeManagementPage()
const { success, warning, error } = useNotification()

const statusOptions: { label: string; value: RecipeStatus }[] = [
  { label: '草稿', value: 'draft' },
  { label: '生效', value: 'active' },
  { label: '归档', value: 'archived' }
]
const openingShapeOptions: OpeningShape[] = ['V型', '||型', '//型']
const laserTransmissionModeOptions: LaserTransmissionMode[] = ['网线', 'RS232']
type EditableFormulaKey =
  | 'angleFormula'
  | 'lowerOpeningFormula'
  | 'depthCompensationFormula'
  | 'compensationAngleFormula'

const editableFormulaItems: Array<{
  key: EditableFormulaKey
  label: string
  symbol: 'A' | 'L' | 'D' | 'CA'
  kLabel: string
  bLabel: string
}> = [
  { key: 'angleFormula', label: '角度公式', symbol: 'A', kLabel: 'K：', bLabel: 'B：' },
  { key: 'lowerOpeningFormula', label: '下开口公式', symbol: 'L', kLabel: 'K：', bLabel: 'B：' },
  { key: 'depthCompensationFormula', label: '深度补偿公式', symbol: 'D', kLabel: 'K：', bLabel: 'B：' },
  { key: 'compensationAngleFormula', label: '补偿角度公式', symbol: 'CA', kLabel: 'K：', bLabel: 'B：' }
]

const openingShapeFormulaPresets: Record<OpeningShape,Partial<Record<EditableFormulaKey, { k: number; b: number }>>> = {
  'V型': {
    angleFormula: { k: 0, b: 0.54 },
    lowerOpeningFormula: { k: 5, b: 35 },
    depthCompensationFormula: { k: 2, b: 0.5 },
    compensationAngleFormula: { k: 0, b: 0 }
  },
  '||型': {
    angleFormula: { k: 0, b: 0 },
    lowerOpeningFormula: { k: 0, b: 50 },
    depthCompensationFormula: { k: 0, b: 0 },
    compensationAngleFormula: { k: 0, b: 0 }
  },
  '//型': {
    angleFormula: { k: 0, b: 0.54 },
    lowerOpeningFormula: { k: 0, b: 50 },
    depthCompensationFormula: { k: 0, b: 0 },
    compensationAngleFormula: { k: 0, b: 0 }
  }
}

const mainRecipeCount = computed(() => recipeState.value.mainRecipes.length)
const activeRecipeCount = computed(
  () => recipeState.value.mainRecipes.filter((recipe) => recipe.status === 'active').length
)
const childRecipeCount = computed(
  () =>
    recipeState.value.laserPowerRecipes.length +
    recipeState.value.blackeningRecipes.length +
    recipeState.value.machiningRecipes.length
)

/** 主配方列表：备注匹配关键词 + 状态筛选（草稿 / 生效 / 归档） */
const filteredMainRecipes = computed(() => {
  const list = recipeState.value.mainRecipes
  const { keyword, recipeStatus } = recipeState.value.filter
  const kw = keyword.trim().toLowerCase()

  let next =
    recipeStatus === 'all' ? list : list.filter((recipe) => recipe.status === recipeStatus)

  if (kw) {
    next = next.filter((recipe) => (recipe.notes ?? '').toLowerCase().includes(kw))
  }

  return next
})

function matchesRecipeRecordKeyword(item: { name: string; code: string; notes: string },kw: string): boolean {
  const t = kw.trim().toLowerCase()
  if (!t) return true
  return [item.name, item.code, item.notes].some((s) => s.toLowerCase().includes(t))
}

function matchesLaserPowerKeyword(item: LaserPowerRecipe, kw: string): boolean {
  const t = kw.trim().toLowerCase()
  if (!t) return true
  const parts = [item.name, item.code, item.notes, item.laserManufacturer]
  return parts.some((s) => s.toLowerCase().includes(t))
}

const filteredBlackeningRecipes = computed(() => {
  const kw = recipeState.value.filter.libraryKeywords.blackening
  return recipeState.value.blackeningRecipes.filter((r) => matchesRecipeRecordKeyword(r, kw))
})

const filteredMachiningRecipes = computed(() => {
  const kw = recipeState.value.filter.libraryKeywords.machining
  return recipeState.value.machiningRecipes.filter((r) => matchesRecipeRecordKeyword(r, kw))
})

const filteredLaserPowerRecipes = computed(() => {
  const kw = recipeState.value.filter.libraryKeywords.laserPower
  return recipeState.value.laserPowerRecipes.filter((r) => matchesLaserPowerKeyword(r, kw))
})

const filteredHorizontalFormulaRecipes = computed(() => {
  const kw = recipeState.value.filter.libraryKeywords.horizontalFormula
  return recipeState.value.horizontalFormulaRecipes.filter((r) => matchesRecipeRecordKeyword(r, kw))
})

const filteredVerticalFormulaRecipes = computed(() => {
  const kw = recipeState.value.filter.libraryKeywords.verticalFormula
  return recipeState.value.verticalFormulaRecipes.filter((r) => matchesRecipeRecordKeyword(r, kw))
})

const selectedMainRecipe = computed(
  () =>
    recipeState.value.mainRecipes.find(
      (recipe) => recipe.id === recipeState.value.selectedMainRecipeId
    ) ?? recipeState.value.mainRecipes[0] ?? null
)

const selectedBlackeningRecipe = computed(
  () =>
    recipeState.value.blackeningRecipes.find(
      (recipe) => recipe.id === selectedMainRecipe.value?.blackeningRecipeId
    ) ?? null
)

const selectedMachiningRecipe = computed(
  () =>
    recipeState.value.machiningRecipes.find(
      (recipe) => recipe.id === selectedMainRecipe.value?.machiningRecipeId
    ) ?? null
)

const horizontalFormulaMap = computed(() =>
  new Map(recipeState.value.horizontalFormulaRecipes.map((recipe) => [recipe.id, recipe]))
)

const verticalFormulaMap = computed(() =>
  new Map(recipeState.value.verticalFormulaRecipes.map((recipe) => [recipe.id, recipe]))
)

const laserPowerMap = computed(
  () => new Map(recipeState.value.laserPowerRecipes.map((recipe) => [recipe.id, recipe]))
)

const activeEditorPanel = ref<EditorPanel>('main')
const savingMainRecipeFile = ref(false)

type ReferencePopoverKind = 'blackening' | 'machining'
const referencePopoverKind = ref<ReferencePopoverKind | null>(null)

const referenceCards = computed(() => [
  {
    kind: 'blackening' as const,
    summaryLabel: '已选扫黑工艺配方',
    name: selectedBlackeningRecipe.value?.name ?? '未选择'
  },
  {
    kind: 'machining' as const,
    summaryLabel: '已选加工工艺配方',
    name: selectedMachiningRecipe.value?.name ?? '未选择'
  }
])

const referenceDetailSectionByKind = computed(() => {
  const list = childRecipeDetailSections.value
  return {
    blackening: list.find((s) => s.id === 'recipe-blackening-detail') ?? null,
    machining: list.find((s) => s.id === 'recipe-machining-detail') ?? null
  }
})

const activeReferenceDetailSection = computed(() => {
  const k = referencePopoverKind.value
  if (!k) return null
  return referenceDetailSectionByKind.value[k]
})

const REFERENCE_POPOVER_HIDE_DELAY_MS = 400
let referencePopoverHideTimer: number | null = null

function clearReferencePopoverHideTimer(): void {
  if (referencePopoverHideTimer !== null) {
    window.clearTimeout(referencePopoverHideTimer)
    referencePopoverHideTimer = null
  }
}

function onReferenceCardEnter(kind: ReferencePopoverKind): void {
  clearReferencePopoverHideTimer()
  referencePopoverKind.value = kind
}

function onReferenceCardLeave(): void {
  clearReferencePopoverHideTimer()
  referencePopoverHideTimer = window.setTimeout(() => {
    referencePopoverKind.value = null
    referencePopoverHideTimer = null
  }, REFERENCE_POPOVER_HIDE_DELAY_MS)
}

function onReferenceCenterPanelEnter(): void {
  clearReferencePopoverHideTimer()
}

function onReferenceCenterPanelLeave(): void {
  referencePopoverKind.value = null
}

function closeReferenceCenterPanel(): void {
  clearReferencePopoverHideTimer()
  referencePopoverKind.value = null
}

type ProcessLibraryKind = 'machining'
type ProcessDetailFieldKind = 'laserPower' | 'horizontal' | 'vertical'

const processDetailHover = ref<{
  library: ProcessLibraryKind
  recipeId: string
  kind: ProcessDetailFieldKind
} | null>(null)

const activeProcessDetailPopover = computed(() => {
  const h = processDetailHover.value
  if (!h) return null

  const mr = recipeState.value.machiningRecipes.find((r) => r.id === h.recipeId)
  if (!mr) return null
  if (h.kind === 'laserPower') {
    const lp = laserPowerMap.value.get(mr.laserPowerRecipeId)
    return {
      title: '激光功率配方',
      description: lp ? `${lp.name}（${lp.code}）` : '当前未关联有效配方',
      fields: getLaserPowerFields(lp)
    }
  }
  if (h.kind === 'horizontal') {
    const shared = getHorizontalFormulaById(mr.horizontalFormulaId)
    return {
      title: '水平工艺配方',
      description: shared ? `${shared.name}（${shared.code}）` : '当前未选择',
      fields: getFormulaFields(shared?.formula)
    }
  }
  const shared = getVerticalFormulaById(mr.verticalFormulaId)
  return {
    title: '垂直工艺配方',
    description: shared ? `${shared.name}（${shared.code}）` : '当前未选择',
    fields: getVerticalFormulaFields(shared?.formula)
  }
})

const PROCESS_DETAIL_HIDE_DELAY_MS = 400
let processDetailHideTimer: number | null = null

function clearProcessDetailHideTimer(): void {
  if (processDetailHideTimer !== null) {
    window.clearTimeout(processDetailHideTimer)
    processDetailHideTimer = null
  }
}

function onProcessDetailRowEnter(library: ProcessLibraryKind,recipeId: string,kind: ProcessDetailFieldKind): void {
  clearProcessDetailHideTimer()
  processDetailHover.value = { library, recipeId, kind }
}

function onProcessDetailRowLeave(): void {
  clearProcessDetailHideTimer()
  processDetailHideTimer = window.setTimeout(() => {
    processDetailHover.value = null
    processDetailHideTimer = null
  }, PROCESS_DETAIL_HIDE_DELAY_MS)
}

function onProcessDetailPanelEnter(): void {
  clearProcessDetailHideTimer()
}

function onProcessDetailPanelLeave(): void {
  processDetailHover.value = null
}

function closeProcessDetailPanel(): void {
  clearProcessDetailHideTimer()
  processDetailHover.value = null
}

onUnmounted(() => {
  clearReferencePopoverHideTimer()
  clearProcessDetailHideTimer()
})
const editorPanelOptions: { key: EditorPanel; label: string }[] = [
  { key: 'main', label: '主配方' },
  { key: 'blackening', label: '扫黑工艺配方' },
  { key: 'machining', label: '加工工艺配方' },
  { key: 'laserPower', label: '激光功率配方' },
  { key: 'horizontal', label: '水平工艺配方' },
  { key: 'vertical', label: '垂直工艺配方' }
]

const childRecipeDetailSections = computed(() =>
  sections.value.filter((section) => section.id.endsWith('-detail'))
)

const otherSections = computed(() =>
  sections.value.filter((section) => !section.id.endsWith('-detail'))
)

function createTimestamp(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function markMainRecipeUpdated(): void {
  if (!selectedMainRecipe.value) return
  selectedMainRecipe.value.updatedAt = createTimestamp()
}

function formatLinearFormula(symbol: 'A' | 'L' | 'D' | 'CA',formula?: ProcessFormulaRecipe[EditableFormulaKey]) {
  if (!formula) return '-'
  return `${symbol} = ${formula.k} * 深度 + ${formula.b}`
}

function getFormulaFields(recipe?: ProcessFormulaRecipe) {
  return [
    { key: 'name', label: '工艺名称', value: recipe?.name ?? '-' },
    { key: 'openingShape', label: '开口形状', value: recipe?.openingShape ?? '-' },
    { key: 'angleFormula', label: '角度公式', value: formatLinearFormula('A', recipe?.angleFormula) },
    {
      key: 'lowerOpeningFormula',
      label: '下开口公式',
      value: formatLinearFormula('L', recipe?.lowerOpeningFormula)
    },
    {
      key: 'depthCompensationFormula',
      label: '深度补偿公式',
      value: formatLinearFormula('D', recipe?.depthCompensationFormula)
    },
    { key: 'upperOpeningFormula', label: '上开口公式', value: recipe?.upperOpeningFormula ?? '-' },
    {
      key: 'compensationAngleFormula',
      label: '补偿角度公式',
      value: formatLinearFormula('CA', recipe?.compensationAngleFormula)
    },
    { key: 'focusCompensation', label: '焦距补偿', value: recipe?.focusCompensation ?? '-' }
  ]
}

function formatChangeFormula(formula?: VerticalProcessFormulaRecipe['edgeCutting']['change']): string {
  if (!formula) return '-'
  return `CHANGE = ${formula.k} * 距离(mm) + ${formula.b}`
}

function getVerticalFormulaFields(recipe?: VerticalProcessFormulaRecipe) {
  return [
    { key: 'cuttingAxis', label: '切割轴（XY/R）', value: recipe?.cuttingAxis ?? '-' },
    { key: 'changePercent', label: '变化百分比', value: recipe?.changePercent ?? '-' },
    { key: 'xFeed', label: 'X_偏移量（mm）', value: recipe?.xFeed ?? '-' },
    { key: 'xSpeed', label: '插补运行速度（mm/s）', value: recipe?.xSpeed ?? '-' },
    { key: 'edgeSpeed', label: '边缘切割百分比（%）', value: recipe?.edgeCutting.speed ?? '-' },
    { key: 'edgeCutTimes', label: '切割次数（次）', value: recipe?.edgeCutting.cutTimes ?? '-' },
    { key: 'cutSpeedNums', label: '切割速量(次)', value: recipe?.edgeCutting.cutSpeedNums ?? '-' },
    { key: 'edgeChange', label: '边缘切割变化', value: formatChangeFormula(recipe?.edgeCutting.change) },
    { key: 'middleSpeed', label: '中间切割百分比（%）', value: recipe?.middleCutting.speed ?? '-' },
    { key: 'middleCutTimes', label: '中间切割次数（次）', value: recipe?.middleCutting.cutTimes ?? '-' },
    {key: 'middleChange',label: '中间切割 CHANGE',value: formatChangeFormula(recipe?.middleCutting.change)},
    { key: 'descentSpeed', label: '下降量(mm/层)', value: recipe?.descentCutting.speed ?? '-' },
    { key: 'descentZFeed', label: '下降减少量(mm/%)', value: recipe?.descentCutting.zFeed ?? '-' },
    {key: 'descentChange',label: '下降切割 CHANGE',value: formatChangeFormula(recipe?.descentCutting.change)}
  ]
}

function getLaserPowerFields(lp?: LaserPowerRecipe | null) {
  if (!lp) return []
  return [
    { key: 'name', label: '配方名称', value: lp.name },
    { key: 'code', label: '配方编码', value: lp.code },
    { key: 'laserManufacturer', label: '激光厂家', value: lp.laserManufacturer },
    { key: 'laserPower', label: '激光功率', value: lp.laserPower },
    { key: 'laserFrequency', label: '激光频率', value: lp.laserFrequency },
    { key: 'laserCurrent', label: '激光电流', value: lp.laserCurrent },
    { key: 'transmissionMode', label: '传输方式', value: lp.transmissionMode }
  ]
}

function getHorizontalFormulaById(id?: string) {
  return id ? horizontalFormulaMap.value.get(id) ?? null : null
}

function getVerticalFormulaById(id?: string) {
  return id ? verticalFormulaMap.value.get(id) ?? null : null
}

function buildSelectedMainRecipeDetails() {
  const mainRecipe = selectedMainRecipe.value ? cloneSettings(selectedMainRecipe.value) : null
  const blackeningRecipe = selectedBlackeningRecipe.value
    ? {
        ...cloneSettings(selectedBlackeningRecipe.value),
        laserPowerRecipe: (() => {
          const sel = selectedBlackeningRecipe.value
          const lp = sel ? laserPowerMap.value.get(sel.laserPowerRecipeId) : undefined
          return lp ? cloneSettings(lp) : null
        })()
      }
    : null

  const machiningRecipe = selectedMachiningRecipe.value
    ? {
        ...cloneSettings(selectedMachiningRecipe.value),
        laserPowerRecipe: (() => {
          const sel = selectedMachiningRecipe.value
          const lp = sel ? laserPowerMap.value.get(sel.laserPowerRecipeId) : undefined
          return lp ? cloneSettings(lp) : null
        })(),
        horizontalFormulaRecipe: cloneSettings(
          getHorizontalFormulaById(selectedMachiningRecipe.value.horizontalFormulaId)
        ),
        verticalFormulaRecipe: cloneSettings(
          getVerticalFormulaById(selectedMachiningRecipe.value.verticalFormulaId)
        )
      }
    : null

  return {
    selectedMainRecipeId: recipeState.value.selectedMainRecipeId,
    savedAt: new Date().toISOString(),
    mainRecipe,
    blackeningRecipe,
    machiningRecipe
  }
}

function markProcessRecipeUpdated(recipe: { updatedAt: string }): void {
  recipe.updatedAt = createTimestamp()
}

function markSharedFormulaUpdated(recipe: { updatedAt: string }): void {
  recipe.updatedAt = createTimestamp()
}

function getFormulaLinkedProcessNames(type: FormulaType, id: string): string[] {
  return recipeState.value.machiningRecipes
    .filter((recipe) =>
      type === 'horizontal' ? recipe.horizontalFormulaId === id : recipe.verticalFormulaId === id
    )
    .map((recipe) => `加工：${recipe.name}`)
}

function isFormulaLinked(type: FormulaType, id: string): boolean {
  return getFormulaLinkedProcessNames(type, id).length > 0
}

function getLaserPowerLinkedProcessNames(id: string): string[] {
  const linkedBlackening = recipeState.value.blackeningRecipes
    .filter((recipe) => recipe.laserPowerRecipeId === id)
    .map((recipe) => `扫黑：${recipe.name}`)

  const linkedMachining = recipeState.value.machiningRecipes
    .filter((recipe) => recipe.laserPowerRecipeId === id)
    .map((recipe) => `加工：${recipe.name}`)

  return [...linkedBlackening, ...linkedMachining]
}

function isLaserPowerLinked(id: string): boolean {
  return getLaserPowerLinkedProcessNames(id).length > 0
}

function getLinkedMainRecipeNames(type: ChildRecipeType, id: string): string[] {
  return recipeState.value.mainRecipes
    .filter((recipe) => {
      if (type === 'blackening') return recipe.blackeningRecipeId === id
      return recipe.machiningRecipeId === id
    })
    .map((recipe) => recipe.name)
}

function isChildRecipeLinked(type: ChildRecipeType, id: string): boolean {
  return getLinkedMainRecipeNames(type, id).length > 0
}

function selectMainRecipe(id: string): void {
  recipeStore.selectMainRecipe(id)
}

function switchEditorPanel(panel: EditorPanel): void {
  activeEditorPanel.value = panel
}

function addMainRecipe(): void {
  if (
    !recipeState.value.laserPowerRecipes.length ||
    !recipeState.value.blackeningRecipes.length ||
    !recipeState.value.machiningRecipes.length
  ) {
    warning(
      '无法新增主配方',
      '请先保证激光功率、扫黑、加工等子配方已就绪（至少各有一个可用的工艺子配方）。'
    )
    return
  }
  recipeStore.addMainRecipe()
  success('已新增主配方', '新主配方已自动绑定两类工艺配方。')
}

function removeMainRecipe(id: string): void {
  const target = recipeState.value.mainRecipes.find((recipe) => recipe.id === id)
  recipeStore.removeMainRecipe(id)
  success('已删除主配方', target?.name ?? '主配方已删除。')
}

function addBlackeningRecipe(): void {
  if (!recipeState.value.laserPowerRecipes.length) {
    warning('无法新增扫黑工艺配方', '请先至少创建一个激光功率配方。')
    return
  }
  recipeStore.addBlackeningRecipe()
  success('已新增扫黑工艺配方')
}

function removeBlackeningRecipe(id: string): void {
  const linkedNames = getLinkedMainRecipeNames('blackening', id)
  if (linkedNames.length) {
    warning('无法删除扫黑工艺配方', `已被主配方引用：${linkedNames.join('、')}`)
    return
  }
  recipeStore.removeBlackeningRecipe(id)
  success('已删除扫黑工艺配方')
}

function addMachiningRecipe(): void {
  if (
    !recipeState.value.horizontalFormulaRecipes.length ||
    !recipeState.value.verticalFormulaRecipes.length ||
    !recipeState.value.laserPowerRecipes.length
  ) {
    warning(
      '无法新增加工工艺配方',
      '请先至少创建一个激光功率配方、一个水平工艺配方和一个垂直工艺配方。'
    )
    return
  }
  recipeStore.addMachiningRecipe()
  success('已新增加工工艺配方')
}

function removeMachiningRecipe(id: string): void {
  const linkedNames = getLinkedMainRecipeNames('machining', id)
  if (linkedNames.length) {
    warning('无法删除加工工艺配方', `已被主配方引用：${linkedNames.join('、')}`)
    return
  }
  recipeStore.removeMachiningRecipe(id)
  success('已删除加工工艺配方')
}

function addHorizontalFormulaRecipe(): void {
  recipeStore.addHorizontalFormulaRecipe()
  success('已新增水平工艺配方')
}

function removeHorizontalFormulaRecipe(id: string): void {
  const linkedNames = getFormulaLinkedProcessNames('horizontal', id)
  if (linkedNames.length) {
    warning('无法删除水平工艺配方', `已被工艺配方引用：${linkedNames.join('、')}`)
    return
  }
  recipeStore.removeHorizontalFormulaRecipe(id)
  success('已删除水平工艺配方')
}

function addVerticalFormulaRecipe(): void {
  recipeStore.addVerticalFormulaRecipe()
  success('已新增垂直工艺配方')
}

function removeVerticalFormulaRecipe(id: string): void {
  const linkedNames = getFormulaLinkedProcessNames('vertical', id)
  if (linkedNames.length) {
    warning('无法删除垂直工艺配方', `已被工艺配方引用：${linkedNames.join('、')}`)
    return
  }
  recipeStore.removeVerticalFormulaRecipe(id)
  success('已删除垂直工艺配方')
}

function addLaserPowerRecipe(): void {
  recipeStore.addLaserPowerRecipe()
  success('已新增激光功率配方')
}

function removeLaserPowerRecipe(id: string): void {
  const linkedNames = getLaserPowerLinkedProcessNames(id)
  if (linkedNames.length) {
    warning('无法删除激光功率配方', `已被引用：${linkedNames.join('、')}`)
    return
  }
  recipeStore.removeLaserPowerRecipe(id)
  success('已删除激光功率配方')
}

async function handleSaveMainRecipeToFile(): Promise<void> {
  if (!selectedMainRecipe.value) {
    warning('保存失败', '当前没有可保存的主配方。')
    return
  }

  savingMainRecipeFile.value = true
  try {
    await recipeStore.saveRecipeState(cloneSettings(recipeState.value))
    const json = JSON.stringify(buildSelectedMainRecipeDetails(), null, 2)
    const res = await window.api.saveJsonToFile('main-recipe-details', json)
    if (res.ok) {
      success('已保存', res.filePath)
      return
    }
    if ('canceled' in res && res.canceled) {
      return
    }
    error('保存失败', 'error' in res ? res.error : '')
  } finally {
    savingMainRecipeFile.value = false
  }
}

onMounted(async () => {
  await recipeStore.loadRecipeState()
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div>
            <p class="app-text-secondary text-sm">工艺与模板中心</p>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">配方管理</h1>
          </div>

          <div
            class="flex flex-wrap justify-center gap-2 px-4 lg:self-center lg:border-x lg:border-dashed lg:border-(--app-border)"
          >
            <button
              v-for="option in editorPanelOptions"
              :key="`panel-${option.key}`"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
              :class="
                activeEditorPanel === option.key
                  ? 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
                  : 'border-(--app-border) app-card-soft app-text-secondary hover:border-blue-300 hover:text-blue-600'
              "
              @click="switchEditorPanel(option.key)"
            >
              {{ option.label }}
            </button>
          </div>

          <RouterLink
            to="/home"
            class="rounded-xl bg-slate-800 px-5 py-3 text-center font-medium text-white transition hover:bg-slate-900 lg:justify-self-end"
          >
            返回首页
          </RouterLink>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-3" v-if="activeEditorPanel === 'main'">
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <p class="app-text-secondary text-sm">主配方数量</p>
          <p class="app-text-primary mt-2 text-2xl font-semibold">{{ mainRecipeCount }}</p>
        </div>

        <div class="app-card rounded-2xl p-5 shadow-sm">
          <p class="app-text-secondary text-sm">生效主配方</p>
          <p class="app-text-primary mt-2 text-2xl font-semibold">{{ activeRecipeCount }}</p>
        </div>

        <div class="app-card rounded-2xl p-5 shadow-sm">
          <p class="app-text-secondary text-sm">子配方总数</p>
          <p class="app-text-primary mt-2 text-2xl font-semibold">{{ childRecipeCount }}</p>
        </div>
      </div>

      <section v-if="activeEditorPanel === 'main'" class="app-card rounded-2xl p-4 shadow-sm">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="app-text-primary text-lg font-semibold">主配方列表</h2>
            <p class="app-text-secondary mt-1 text-xs leading-snug">
              先选中主配方，再在下方编辑它所绑定的两个工艺子配方。可通过关键词（备注）与状态（草稿/生效/归档）缩小列表。
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            @click="addMainRecipe"
          >
            新增主配方
          </button>
        </div>

        <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
          <label class="flex min-w-0 flex-1  gap-4">
            <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
            <input
              v-model="recipeState.filter.keyword"
              type="search"
              placeholder="输入文字筛选主配方备注"
              class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
            />
          </label>
          <label class="flex w-full sm:w-auto sm:min-w-56">
            <select
              v-model="recipeState.filter.recipeStatus"
              class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
            >
              <option value="all" class="text-slate-900">全部</option>
              <option
                v-for="opt in statusOptions"
                :key="`filter-status-${opt.value}`"
                :value="opt.value"
                class="text-slate-900"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
        </div>

        <p
          v-if="!filteredMainRecipes.length"
          class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
        >
          当前筛选条件下没有主配方，请调整关键词或状态筛选。
        </p>

        <div
          v-else
          class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="recipe in filteredMainRecipes"
            :key="recipe.id"
            class="min-w-0 rounded-xl border px-3 py-2.5 text-left transition"
            :class="
              recipe.id === recipeState.selectedMainRecipeId
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20'
                : 'border-(--app-border) app-card-soft'
            "
            @click="selectMainRecipe(recipe.id)"
          >
            <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div class="min-w-0 flex-1">
                <p class="app-text-primary text-sm font-semibold leading-tight">{{ recipe.name }}</p>
                <p class="app-text-secondary mt-0.5 text-xs leading-snug">
                  {{ recipe.code }} / {{ recipe.version }} / {{ recipe.productModel }}
                </p>
                <p class="app-text-secondary mt-1 text-xs leading-snug">
                  扫黑：{{
                    recipeState.blackeningRecipes.find((item) => item.id === recipe.blackeningRecipeId)
                      ?.name ?? '-'
                  }}
                  <span class="text-slate-400 dark:text-slate-500"> · </span>
                  加工：{{
                    recipeState.machiningRecipes.find((item) => item.id === recipe.machiningRecipeId)
                      ?.name ?? '-'
                  }}
                </p>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                <span
                  class="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                >
                  {{ recipe.status }}
                </span>
                <button
                  type="button"
                  class="rounded-md border border-red-200 px-2 py-0.5 text-[11px] leading-none text-red-600 transition hover:bg-red-50"
                  @click.stop="removeMainRecipe(recipe.id)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="activeEditorPanel === 'main' && selectedMainRecipe"
        class="app-card rounded-2xl p-4 shadow-sm"
      >
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="app-text-primary text-lg font-semibold">当前主配方编辑</h2>
            <p class="app-text-secondary mt-1 text-xs leading-snug">
              当前主配方必须同时选择一个扫黑工艺配方和一个加工工艺配方。
            </p>
          </div>
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="savingMainRecipeFile"
            @click="handleSaveMainRecipeToFile"
          >
            {{ savingMainRecipeFile ? '保存中...' : '保存为JSON文件' }}
          </button>
        </div>

        <div class="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">主配方名称</span>
            <input
              v-model="selectedMainRecipe.name"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @input="markMainRecipeUpdated"
            />
          </label>

          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">产品型号</span>
            <input
              v-model="selectedMainRecipe.productModel"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @input="markMainRecipeUpdated"
            />
          </label>

          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">版本号</span>
            <input
              v-model="selectedMainRecipe.version"
              type="text"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @input="markMainRecipeUpdated"
            />
          </label>

          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">状态</span>
            <select
              v-model="selectedMainRecipe.status"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markMainRecipeUpdated"
            >
              <option
                v-for="status in statusOptions"
                :key="status.value"
                :value="status.value"
                class="text-slate-900"
              >
                {{ status.label }}
              </option>
            </select>
          </label>

          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">扫黑工艺配方</span>
            <select
              v-model="selectedMainRecipe.blackeningRecipeId"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markMainRecipeUpdated"
            >
              <option
                v-for="recipe in recipeState.blackeningRecipes"
                :key="recipe.id"
                :value="recipe.id"
                class="text-slate-900"
              >
                {{ recipe.name }}
              </option>
            </select>
          </label>

          <label class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-center gap-2">
            <span class="app-text-secondary shrink-0 text-xs leading-tight">加工工艺配方</span>
            <select
              v-model="selectedMainRecipe.machiningRecipeId"
              class="min-w-0 w-full rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @change="markMainRecipeUpdated"
            >
              <option
                v-for="recipe in recipeState.machiningRecipes"
                :key="recipe.id"
                :value="recipe.id"
                class="text-slate-900"
              >
                {{ recipe.name }}
              </option>
            </select>
          </label>

          <label
            class="grid grid-cols-[minmax(5.25rem,auto)_1fr] items-start gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4"
          >
            <span class="app-text-secondary mt-1.5 shrink-0 text-xs leading-tight">备注</span>
            <textarea
              v-model="selectedMainRecipe.notes"
              rows="2"
              class="min-h-10 max-h-24 min-w-0 w-full resize-y rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              @input="markMainRecipeUpdated"
            />
          </label>
        </div>
      </section>



      
      <section
          v-if="activeEditorPanel === 'main'"
          v-for="section in otherSections"
          :key="section.id"
          class="app-card rounded-2xl p-6 shadow-sm"
        >
          <h2 class="app-text-primary text-xl font-semibold">{{ section.title }}</h2>
          <p class="app-text-secondary mt-2 text-sm">{{ section.description }}</p>

          <div class="mt-5 grid gap-3 md:grid-cols-2">
            <div
              v-for="field in section.fields"
              :key="field.key"
              class="app-card-soft rounded-xl p-4"
            >
              <p class="app-text-secondary text-xs">{{ field.label }}</p>
              <p class="app-text-primary mt-2 text-base font-medium break-all">
                {{ formatSettingValue(field.value, field.unit) }}
              </p>
            </div>
          </div>
      </section>



      <section v-if="activeEditorPanel === 'main'" class="app-card rounded-2xl p-6 shadow-sm">
        <div class="flex items-center gap-2">
          <h2 class="app-text-primary text-xl font-semibold">当前主配方引用详情</h2>
          <span class="app-text-secondary text-xs">悬停各卡片，在屏幕右侧查看详细参数</span>
        </div>
        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div
            v-for="card in referenceCards"
            :key="card.kind"
            @mouseenter="onReferenceCardEnter(card.kind)"
            @mouseleave="onReferenceCardLeave"
          >
            <div class="app-card-soft rounded-2xl p-5">
              <p class="app-text-secondary text-sm">{{ card.summaryLabel }}</p>
              <p class="app-text-primary mt-2 text-lg font-semibold">
                {{ card.name }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="activeEditorPanel === 'main' && selectedMainRecipe"
        class="app-card rounded-2xl p-6 shadow-sm"
      >
        <h2 class="app-text-primary text-xl font-semibold">当前主配方拓扑关系图</h2>
        <div class="mt-4">
          <RecipeTopologyDiagram :state="recipeState" />
        </div>
      </section>

      <div class="space-y-6">
        <RecipeLibrarySection
          v-if="activeEditorPanel === 'blackening'"
          title="扫黑工艺配方库"
          description="扫黑工艺配方包含下降步长、下降次数、扫黑速度、扫黑步进，并引用激光功率配方。"
          add-button-text="新增扫黑工艺配方"
          @add="addBlackeningRecipe"
        >
          <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
            <label class="flex min-w-0 flex-1 gap-2">
              <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
              <input
                v-model="recipeState.filter.libraryKeywords.blackening"
                type="search"
                placeholder="按名称、编码、备注筛选（扫黑工艺）"
                class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <p
            v-if="!filteredBlackeningRecipes.length"
            class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
          >
            当前筛选条件下没有扫黑工艺配方，请调整关键词。
          </p>
          <div v-else class="mt-5 space-y-4">
            <RecipeEditorCard
              v-for="recipe in filteredBlackeningRecipes"
              :key="recipe.id"
              type="blackening"
              :item="recipe"
              :delete-disabled="isChildRecipeLinked('blackening', recipe.id)"
              :warning-text="
                isChildRecipeLinked('blackening', recipe.id)
                  ? `已被主配方引用：${getLinkedMainRecipeNames('blackening', recipe.id).join('、')}`
                  : ''
              "
              :laser-power-options="recipeState.laserPowerRecipes"
              :on-updated="markProcessRecipeUpdated"
              @delete="removeBlackeningRecipe(recipe.id)"
            />
          </div>
        </RecipeLibrarySection>

        <RecipeLibrarySection
          v-if="activeEditorPanel === 'machining'"
          title="加工工艺配方库"
          description="每个加工工艺配方引用激光功率配方，并包含垂直工艺配方与水平工艺配方（公式字段与焦距补偿）。"
          add-button-text="新增加工工艺配方"
          @add="addMachiningRecipe"
        >
          <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
            <label class="flex min-w-0 flex-1 gap-2">
              <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
              <input
                v-model="recipeState.filter.libraryKeywords.machining"
                type="search"
                placeholder="按名称、编码、备注筛选（加工工艺）"
                class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <p
            v-if="!filteredMachiningRecipes.length"
            class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
          >
            当前筛选条件下没有加工工艺配方，请调整关键词。
          </p>
          <div v-else class="mt-5 space-y-4">
            <RecipeEditorCard
              v-for="recipe in filteredMachiningRecipes"
              :key="recipe.id"
              type="machining"
              :item="recipe"
              :delete-disabled="isChildRecipeLinked('machining', recipe.id)"
              :warning-text="
                isChildRecipeLinked('machining', recipe.id)
                  ? `已被主配方引用：${getLinkedMainRecipeNames('machining', recipe.id).join('、')}`
                  : ''
              "
              :laser-power-options="recipeState.laserPowerRecipes"
              :horizontal-formula-options="recipeState.horizontalFormulaRecipes"
              :vertical-formula-options="recipeState.verticalFormulaRecipes"
              :on-updated="markProcessRecipeUpdated"
              :on-hover-enter="(id, kind) => onProcessDetailRowEnter('machining', id, kind)"
              :on-hover-leave="onProcessDetailRowLeave"
              @delete="removeMachiningRecipe(recipe.id)"
            />
          </div>
        </RecipeLibrarySection>

        <RecipeLibrarySection
          v-if="activeEditorPanel === 'laserPower'"
          title="激光功率配方库"
          description="激光功率配方包含激光厂家、激光功率、激光频率、激光电流与使用传输方式，可被扫黑工艺配方与加工工艺配方引用。"
          add-button-text="新增激光功率配方"
          @add="addLaserPowerRecipe"
        >
          <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
            <label class="flex min-w-0 flex-1 gap-2">
              <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
              <input
                v-model="recipeState.filter.libraryKeywords.laserPower"
                type="search"
                placeholder="按名称、编码、备注、激光厂家筛选"
                class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <p
            v-if="!filteredLaserPowerRecipes.length"
            class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
          >
            当前筛选条件下没有激光功率配方，请调整关键词。
          </p>
          <div v-else class="mt-5 space-y-4">
            <RecipeEditorCard
              v-for="recipe in filteredLaserPowerRecipes"
              :key="recipe.id"
              type="laserPower"
              :item="recipe"
              card-class="app-card-soft rounded-2xl border border-(--app-border) p-5"
              :delete-disabled="isLaserPowerLinked(recipe.id)"
              :warning-text="
                isLaserPowerLinked(recipe.id)
                  ? `已被引用：${getLaserPowerLinkedProcessNames(recipe.id).join('、')}`
                  : ''
              "
              :transmission-mode-options="laserTransmissionModeOptions"
              :on-updated="markProcessRecipeUpdated"
              @delete="removeLaserPowerRecipe(recipe.id)"
            />
          </div>
        </RecipeLibrarySection>

        <RecipeLibrarySection
          v-if="activeEditorPanel === 'horizontal'"
          title="水平工艺配方"
          description="水平工艺配方是共享配方库，可被加工工艺配方引用。"
          add-button-text="新增水平工艺配方"
          @add="addHorizontalFormulaRecipe"
        >
          <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
            <label class="flex min-w-0 flex-1 gap-2">
              <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
              <input
                v-model="recipeState.filter.libraryKeywords.horizontalFormula"
                type="search"
                placeholder="按名称、编码、备注筛选（水平工艺）"
                class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <p
            v-if="!filteredHorizontalFormulaRecipes.length"
            class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
          >
            当前筛选条件下没有水平工艺配方，请调整关键词。
          </p>
          <div v-else class="mt-5 space-y-4">
            <RecipeEditorCard
              v-for="formula in filteredHorizontalFormulaRecipes"
              :key="`horizontal-formula-${formula.id}`"
              type="horizontalFormula"
              :item="formula"
              card-class="app-card-soft rounded-2xl border border-(--app-border) p-4"
              :delete-disabled="isFormulaLinked('horizontal', formula.id)"
              :warning-text="
                isFormulaLinked('horizontal', formula.id)
                  ? `已被引用：${getFormulaLinkedProcessNames('horizontal', formula.id).join('、')}`
                  : ''
              "
              :opening-shape-options="openingShapeOptions"
              :opening-shape-formula-presets="openingShapeFormulaPresets"
              :editable-formula-items="editableFormulaItems"
              :format-linear-formula="formatLinearFormula"
              :on-updated="markSharedFormulaUpdated"
              @delete="removeHorizontalFormulaRecipe(formula.id)"
            />
          </div>
        </RecipeLibrarySection>

        <RecipeLibrarySection
          v-if="activeEditorPanel === 'vertical'"
          title="垂直工艺配方"
          description="垂直工艺配方是共享配方库，可被加工工艺配方引用。"
          add-button-text="新增垂直工艺配方"
          @add="addVerticalFormulaRecipe"
        >
          <div class="mt-3 flex gap-4 sm:flex-row sm:items-end">
            <label class="flex min-w-0 flex-1 gap-2">
              <SvgIcon icon-name="icon-sousuo" class-name="text-1xl" />
              <input
                v-model="recipeState.filter.libraryKeywords.verticalFormula"
                type="search"
                placeholder="按名称、编码、备注筛选（垂直工艺）"
                class="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <p
            v-if="!filteredVerticalFormulaRecipes.length"
            class="app-text-secondary mt-3 rounded-lg border border-dashed border-(--app-border) px-3 py-4 text-center text-sm"
          >
            当前筛选条件下没有垂直工艺配方，请调整关键词。
          </p>
          <div v-else class="mt-5 space-y-4">
            <RecipeEditorCard
              v-for="formula in filteredVerticalFormulaRecipes"
              :key="`vertical-formula-${formula.id}`"
              type="verticalFormula"
              :item="formula"
              card-class="app-card-soft rounded-2xl border border-(--app-border) p-4"
              :delete-disabled="isFormulaLinked('vertical', formula.id)"
              :warning-text="
                isFormulaLinked('vertical', formula.id)
                  ? `已被引用：${getFormulaLinkedProcessNames('vertical', formula.id).join('、')}`
                  : ''
              "
              :on-updated="markSharedFormulaUpdated"
              @delete="removeVerticalFormulaRecipe(formula.id)"
            />
          </div>
        </RecipeLibrarySection>


        <!-- 主配方下子配方的悬停展示 -->
        <Teleport to="body">
          <div
            v-if="referencePopoverKind"
            class="pointer-events-none fixed inset-0 z-200 flex items-start justify-center p-4 md:p-6"
          >
            <div class="pointer-events-none absolute inset-0 bg-slate-900/18 dark:bg-black/28"></div>
            <div
              class="pointer-events-auto relative max-h-[90vh] w-[min(64rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)]"
              @mouseenter="onReferenceCenterPanelEnter"
              @mouseleave="onReferenceCenterPanelLeave"
            >
              <button
                type="button"
                class="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs text-(--app-text-muted) transition hover:bg-(--app-card-soft) hover:text-(--app-text-primary)"
                @click="closeReferenceCenterPanel"
              >
                关闭
              </button>
              <template v-if="activeReferenceDetailSection">
                <RecipeDetailFieldPanel
                  :key="`popover-${activeReferenceDetailSection.id}`"
                  :title="activeReferenceDetailSection.title"
                  :description="activeReferenceDetailSection.description"
                  :fields="activeReferenceDetailSection.fields"
                  :field-groups="activeReferenceDetailSection.fieldGroups"
                />
              </template>
              <p v-else class="app-text-secondary px-2 pb-2 text-xs">暂无该工艺引用详情</p>
            </div>
          </div>
        </Teleport>
        <!-- 非主配方其他的悬停展示 -->
        <Teleport to="body">
          <div
            v-if="processDetailHover"
            class="pointer-events-none fixed inset-0 z-210 flex items-start justify-center p-4 md:p-6"
          >
            <div class="pointer-events-none absolute inset-0 bg-slate-900/18 dark:bg-black/28"></div>
            <div
              class="pointer-events-auto relative max-h-[90vh] w-[min(64rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)]"
              @mouseenter="onProcessDetailPanelEnter"
              @mouseleave="onProcessDetailPanelLeave"
            >
              <button
                type="button"
                class="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs text-(--app-text-muted) transition hover:bg-(--app-card-soft) hover:text-(--app-text-primary)"
                @click="closeProcessDetailPanel"
              >
                关闭
              </button>
              <template v-if="activeProcessDetailPopover">
                <RecipeDetailFieldPanel
                  :key="`process-popover-${processDetailHover.library}-${processDetailHover.recipeId}-${processDetailHover.kind}`"
                  :title="activeProcessDetailPopover.title"
                  :description="activeProcessDetailPopover.description"
                  :fields="activeProcessDetailPopover.fields"
                />
              </template>
              <p v-else class="app-text-secondary px-2 pb-2 text-xs">暂无详细数据</p>
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>
