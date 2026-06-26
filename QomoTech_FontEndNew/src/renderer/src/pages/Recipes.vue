<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useL10n } from '../shared/l10n'
import { useRecipes } from '../shared/recipe'
import type { MainRecipe, LaserPowerRecipe, BlackeningRecipe, MachiningRecipe, HorizontalFormulaRecipe, VerticalFormulaRecipe } from '../shared/recipe'

const { t } = useL10n()
const {
  state, mainRecipes, selectedMainRecipeId, selectedRecipe, loading, dirty, lastError,
  load, save, selectRecipe, updateField
} = useRecipes()

// ---- browse mode: which sub-recipe list to show in the center ----
type BrowseMode = 'main' | 'laser' | 'blackening' | 'machining' | 'horizontal' | 'vertical'
const browseMode = ref<BrowseMode>('main')
// which item is selected in each sub-recipe list
const selectedLaserId = ref<string | null>(null)
const selectedBlackeningId = ref<string | null>(null)
const selectedMachiningId = ref<string | null>(null)
const selectedHorizontalId = ref<string | null>(null)
const selectedVerticalId = ref<string | null>(null)

const editingMainId = ref<string | null>(null)
const statusMsg = ref('')
const sidebarSearch = ref('')
const showNewDialog = ref(false)
const newRecipeName = ref('')

const filteredRecipes = computed(() => {
  const q = sidebarSearch.value.toLowerCase()
  if (!q) return mainRecipes.value
  return mainRecipes.value.filter(r => r.name.toLowerCase().includes(q))
})

function findById<T>(arr: readonly T[] | T[] | undefined, id: string): T | undefined {
  return (arr as T[] | undefined)?.find((r: any) => r.id === id)
}

// ----  flattened sub-recipe arrays  ----
const laserList = computed(() => (state.value.laserPowerRecipes ?? []) as LaserPowerRecipe[])
const blackeningList = computed(() => (state.value.blackeningRecipes ?? []) as BlackeningRecipe[])
const machiningList = computed(() => (state.value.machiningRecipes ?? []) as MachiningRecipe[])
const horizontalList = computed(() => (state.value.horizontalFormulaRecipes ?? []) as HorizontalFormulaRecipe[])
const verticalList = computed(() => (state.value.verticalFormulaRecipes ?? []) as VerticalFormulaRecipe[])

// selected sub item from each list
const selLaser = computed(() => selectedLaserId.value ? findById(laserList.value, selectedLaserId.value) : undefined)
const selBlackening = computed(() => selectedBlackeningId.value ? findById(blackeningList.value, selectedBlackeningId.value) : undefined)
const selMachining = computed(() => selectedMachiningId.value ? findById(machiningList.value, selectedMachiningId.value) : undefined)
const selHorizontal = computed(() => selectedHorizontalId.value ? findById(horizontalList.value, selectedHorizontalId.value) : undefined)
const selVertical = computed(() => selectedVerticalId.value ? findById(verticalList.value, selectedVerticalId.value) : undefined)

// ----  Defaults for each sub-recipe type  ----
const SubDefaults: Record<string, Record<string, unknown>> = {
  laser: { laserManufacturer: '', laserPower: 1000, laserFrequency: 5000, laserCurrent: 50 },
  blackening: { enabled: true, descentStep: 0.1, descentCount: 2, blackeningSpeed: 20, blackeningStep: 0.01, jiaojubuchang: 300, saoheikaikou: { k: 0, b: 0 }, laserPowerRecipeId: '' },
  machining: { horizontalFormulaId: '', verticalFormulaId: '', laserPowerRecipeId: '' },
  horizontal: { openingShape: 'V型', angleFormula: { k: 0, b: 0.5 }, lowerOpeningFormula: { k: 5, b: 35 }, depthCompensationFormula: { k: 2, b: 0.5 }, compensationAngleFormula: { k: 0, b: 0 }, focusCompensation: 0.08 },
  vertical: { cuttingAxis: 'XY', changePercent: 10, xFeed: 0.01, xSpeed: 20, edgeCutting: { speed: 50, cutTimes: 2, cutSpeedNums: 5, change: { k: 1, b: 5 } }, middleCutting: { speed: 100, cutTimes: 1, change: { k: 0, b: 50 } }, descentCutting: { speed: 0.075, zFeed: 0.002, change: { k: 10, b: 0.075 } } },
}

function handleNewSub(type: BrowseMode) {
  const id = `${type}-${Date.now()}`
  const defaults = SubDefaults[type] ?? {}
  const empty: Record<string, unknown> = { id, ...defaults }
  const keyMap: Record<string, string> = {
    laser: 'laserPowerRecipes', blackening: 'blackeningRecipes',
    machining: 'machiningRecipes', horizontal: 'horizontalFormulaRecipes', vertical: 'verticalFormulaRecipes'
  }
  const arr = [...(state.value as any)[keyMap[type]] ?? [], empty]
  updateField(keyMap[type], arr)
  if (type === 'laser') selectedLaserId.value = id
  if (type === 'blackening') selectedBlackeningId.value = id
  if (type === 'machining') selectedMachiningId.value = id
  if (type === 'horizontal') selectedHorizontalId.value = id
  if (type === 'vertical') selectedVerticalId.value = id
  statusMsg.value = `已创建新${type}配方`
}

function handleDeleteSub(type: BrowseMode) {
  const selectedId = type === 'laser' ? selectedLaserId.value
    : type === 'blackening' ? selectedBlackeningId.value
    : type === 'machining' ? selectedMachiningId.value
    : type === 'horizontal' ? selectedHorizontalId.value
    : selectedVerticalId.value
  if (!selectedId) return
  const keyMap: Record<string, string> = {
    laser: 'laserPowerRecipes', blackening: 'blackeningRecipes',
    machining: 'machiningRecipes', horizontal: 'horizontalFormulaRecipes', vertical: 'verticalFormulaRecipes'
  }
  const arr = ((state.value as any)[keyMap[type]] ?? []).filter((r: any) => r.id !== selectedId)
  updateField(keyMap[type], arr)
  if (type === 'laser') { selectedLaserId.value = null; if (arr.length > 0) selectedLaserId.value = arr[0].id }
  if (type === 'blackening') { selectedBlackeningId.value = null; if (arr.length > 0) selectedBlackeningId.value = arr[0].id }
  if (type === 'machining') { selectedMachiningId.value = null; if (arr.length > 0) selectedMachiningId.value = arr[0].id }
  if (type === 'horizontal') { selectedHorizontalId.value = null; if (arr.length > 0) selectedHorizontalId.value = arr[0].id }
  if (type === 'vertical') { selectedVerticalId.value = null; if (arr.length > 0) selectedVerticalId.value = arr[0].id }
  statusMsg.value = '已标记删除'
}

// ----  main recipe actions  ----
function handleNew() { newRecipeName.value = ''; showNewDialog.value = true }
function confirmNew() {
  const name = newRecipeName.value.trim() || '新配方'
  const id = 'main-' + Date.now()
  const m: MainRecipe = { id, name, status: 'draft', blackeningRecipeId: '', machiningRecipeId: '' }
  updateField('mainRecipes', [...mainRecipes.value, m])
  selectRecipe(id); editingMainId.value = id; showNewDialog.value = false
  statusMsg.value = '已创建'
}
function handleClone() {
  const src = selectedRecipe.value; if (!src) return
  const id = 'main-' + Date.now()
  const clone: MainRecipe = { ...src, id, name: src.name + ' (副本)', status: 'draft' }
  updateField('mainRecipes', [...mainRecipes.value, clone])
  selectRecipe(id); statusMsg.value = '已克隆'
}
function handleDelete() {
  const id = selectedMainRecipeId.value; if (!id) return
  const arr = mainRecipes.value.filter(r => r.id !== id)
  updateField('mainRecipes', arr); selectRecipe(arr[0]?.id ?? '')
  statusMsg.value = '已标记删除'
}
function updateMainField(key: keyof MainRecipe, value: string) {
  const id = selectedMainRecipeId.value; if (!id) return
  updateField('mainRecipes', mainRecipes.value.map(r => r.id === id ? { ...r, [key]: value } : r))
}
async function handleSave() {
  statusMsg.value = '保存中...'; await save()
  statusMsg.value = lastError.value ? `失败: ${lastError.value}` : '已保存'
  if (!lastError.value) setTimeout(() => { statusMsg.value = '' }, 2000)
}
onMounted(async () => {
  await load()
  if (mainRecipes.value.length > 0 && !selectedMainRecipeId.value) selectRecipe(mainRecipes.value[0].id)
  if (laserList.value.length > 0) selectedLaserId.value = laserList.value[0].id
  if (blackeningList.value.length > 0) selectedBlackeningId.value = blackeningList.value[0].id
  if (machiningList.value.length > 0) selectedMachiningId.value = machiningList.value[0].id
  if (horizontalList.value.length > 0) selectedHorizontalId.value = horizontalList.value[0].id
  if (verticalList.value.length > 0) selectedVerticalId.value = verticalList.value[0].id
})
</script>

<template>
  <div class="recipes-page">
    <!-- NEW DIALOG -->
    <Teleport to="body">
      <div v-if="showNewDialog" class="dlg-overlay" @click.self="showNewDialog = false">
        <div class="dlg-card">
          <span class="dlg-title">新建主配方</span>
          <input v-model="newRecipeName" class="dlg-input" placeholder="配方名称..." @keydown.enter="confirmNew" autofocus />
          <div class="dlg-btns">
            <button class="dlg-ok" @click="confirmNew">确定</button>
            <button class="dlg-cancel" @click="showNewDialog = false">取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- LEFT SIDEBAR — main recipe list -->
    <aside class="recipe-sidebar">
      <div class="sidebar-head">
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input v-model="sidebarSearch" type="text" class="search-input" :placeholder="t('recipes.searchPlaceholder')" />
        </div>
        <div class="sidebar-actions">
          <button class="act-btn" @click="handleNew"><span class="material-symbols-outlined">add</span>{{ t('recipes.new') }}</button>
          <button class="act-btn" @click="handleClone" :disabled="!selectedRecipe"><span class="material-symbols-outlined">content_copy</span>克隆</button>
          <button class="act-btn danger" @click="handleDelete" :disabled="!selectedRecipe"><span class="material-symbols-outlined">delete</span></button>
        </div>
      </div>
      <div class="recipe-list">
        <button v-for="r in filteredRecipes" :key="r.id" class="recipe-item" :class="{ active: r.id === selectedMainRecipeId }"
          @click="selectRecipe(r.id); browseMode = 'main'">
          <div class="ri-top"><span class="ri-name">{{ r.name }}</span><span class="ri-status" :class="r.status">{{ r.status }}</span></div>
          <div class="ri-sub">{{ r.id }}</div>
        </button>
        <div v-if="filteredRecipes.length === 0 && !loading" class="recipe-empty">
          <span class="material-symbols-outlined empty-icon">science</span>
          <span class="empty-text">暂无配方</span>
        </div>
      </div>
      <div class="sidebar-foot">
        <button class="save-btn" :class="{ pulse: dirty }" @click="handleSave" :disabled="!dirty">
          <span class="material-symbols-outlined">save</span>{{ dirty ? t('recipes.saveChanges') : '已保存' }}
        </button>
        <span v-if="statusMsg" class="status-msg">{{ statusMsg }}</span>
        <span v-if="loading" class="status-msg dim">加载中...</span>
      </div>
    </aside>

    <!-- CENTER — browse list of sub-recipes + editor -->
    <div class="recipe-center">
      <!-- Main recipe editor -->
      <div v-if="browseMode === 'main' && selectedRecipe" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">
            <input v-if="editingMainId === selectedMainRecipeId" :value="selectedRecipe.name" class="ed-title-input"
              @input="updateMainField('name', ($event.target as HTMLInputElement).value)"
              @blur="editingMainId = null" @keydown.enter="editingMainId = null" />
            <span v-else @dblclick="editingMainId = selectedMainRecipeId">{{ selectedRecipe.name }}</span>
            <span class="ed-id">{{ selectedRecipe.id }}</span>
          </h2>
        </div>
        <section class="edit-section">
          <div class="field-grid">
            <div class="field"><label class="fl">名称</label><input class="fi" :value="selectedRecipe.name" @input="updateMainField('name', ($event.target as HTMLInputElement).value)" /></div>
            <div class="field"></div>
            <div class="field"></div>
            <div class="field"><label class="fl">状态</label><select class="fi" :value="selectedRecipe.status" @change="updateMainField('status', ($event.target as HTMLSelectElement).value)"><option value="active">active</option><option value="draft">draft</option></select></div>
            <div class="field"></div>
            <div class="field"></div>
            <div class="field"><label class="fl">扫黑配方 ID</label><input class="fi mono" :value="selectedRecipe.blackeningRecipeId" @input="updateMainField('blackeningRecipeId', ($event.target as HTMLInputElement).value)" /></div>
            <div class="field"><label class="fl">加工配方 ID</label><input class="fi mono" :value="selectedRecipe.machiningRecipeId" @input="updateMainField('machiningRecipeId', ($event.target as HTMLInputElement).value)" /></div>
          </div>
        </section>
      </div>

      <!-- Laser list + editor -->
      <div v-if="browseMode === 'laser'" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">激光功率配方</h2>
          <div class="center-actions">
            <button class="act-sm" @click="handleNewSub('laser')"><span class="material-symbols-outlined">add</span></button>
            <button class="act-sm danger" @click="handleDeleteSub('laser')" :disabled="!selLaser"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="sub-items-row">
          <button v-for="item in laserList" :key="item.id" class="sub-item"
            :class="{ active: item.id === selectedLaserId }" @click="selectedLaserId = item.id">
            <span class="sub-item-name">{{ item.id }}</span>
          </button>
        </div>
        <section v-if="selLaser" class="edit-section">
          <div class="field-grid">
            <div class="field"><label class="fl">厂家</label><input class="fi mono" :value="selLaser.laserManufacturer" @input="updateField(`laserPowerRecipes.${selLaser.id}.laserManufacturer`, ($event.target as HTMLInputElement).value)" /></div>
            <div class="field"></div>
            <div class="field"></div>
            <div class="field"><label class="fl">功率 (W)</label><input class="fi" type="number" :value="selLaser.laserPower" @input="updateField(`laserPowerRecipes.${selLaser.id}.laserPower`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">频率 (Hz)</label><input class="fi" type="number" :value="selLaser.laserFrequency" @input="updateField(`laserPowerRecipes.${selLaser.id}.laserFrequency`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">电流 (A)</label><input class="fi" type="number" :value="selLaser.laserCurrent" @input="updateField(`laserPowerRecipes.${selLaser.id}.laserCurrent`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>
        </section>
      </div>

      <!-- Blackening list + editor -->
      <div v-if="browseMode === 'blackening'" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">扫黑配方</h2>
          <div class="center-actions">
            <button class="act-sm" @click="handleNewSub('blackening')"><span class="material-symbols-outlined">add</span></button>
            <button class="act-sm danger" @click="handleDeleteSub('blackening')" :disabled="!selBlackening"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="sub-items-row">
          <button v-for="item in blackeningList" :key="item.id" class="sub-item"
            :class="{ active: item.id === selectedBlackeningId }" @click="selectedBlackeningId = item.id">
            <span class="sub-item-name">{{ item.id }}</span>
          </button>
        </div>
        <section v-if="selBlackening" class="edit-section">
          <div class="field-grid">
            <div class="field"><label class="fl">启用</label><select class="fi" :value="selBlackening.enabled" @change="updateField(`blackeningRecipes.${selBlackening.id}.enabled`, ($event.target as HTMLSelectElement).value === 'true')"><option :value="true">是</option><option :value="false">否</option></select></div>
            <div class="field"></div>
            <div class="field"></div>
            <div class="field"><label class="fl">下降步长</label><input class="fi" type="number" step="0.01" :value="selBlackening.descentStep" @input="updateField(`blackeningRecipes.${selBlackening.id}.descentStep`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">下降次数</label><input class="fi" type="number" :value="selBlackening.descentCount" @input="updateField(`blackeningRecipes.${selBlackening.id}.descentCount`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">扫黑速度</label><input class="fi" type="number" :value="selBlackening.blackeningSpeed" @input="updateField(`blackeningRecipes.${selBlackening.id}.blackeningSpeed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">扫黑步长</label><input class="fi" type="number" step="0.001" :value="selBlackening.blackeningStep" @input="updateField(`blackeningRecipes.${selBlackening.id}.blackeningStep`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">焦距补偿</label><input class="fi" type="number" :value="selBlackening.jiaojubuchang" @input="updateField(`blackeningRecipes.${selBlackening.id}.jiaojubuchang`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>
        </section>
      </div>

      <!-- Machining list + editor -->
      <div v-if="browseMode === 'machining'" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">加工配方</h2>
          <div class="center-actions">
            <button class="act-sm" @click="handleNewSub('machining')"><span class="material-symbols-outlined">add</span></button>
            <button class="act-sm danger" @click="handleDeleteSub('machining')" :disabled="!selMachining"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="sub-items-row">
          <button v-for="item in machiningList" :key="item.id" class="sub-item"
            :class="{ active: item.id === selectedMachiningId }" @click="selectedMachiningId = item.id">
            <span class="sub-item-name">{{ item.id }}</span>
          </button>
        </div>
        <section v-if="selMachining" class="edit-section">
          <div class="field-grid">
            <div class="field"><label class="fl">水平配方</label>
              <select class="fi" :value="selMachining.horizontalFormulaId" @change="updateField(`machiningRecipes.${selMachining.id}.horizontalFormulaId`, ($event.target as HTMLSelectElement).value)">
                <option value="">—</option>
                <option v-for="h in horizontalList" :key="h.id" :value="h.id">{{ h.id }}</option>
              </select>
            </div>
            <div class="field"><label class="fl">垂直配方</label>
              <select class="fi" :value="selMachining.verticalFormulaId" @change="updateField(`machiningRecipes.${selMachining.id}.verticalFormulaId`, ($event.target as HTMLSelectElement).value)">
                <option value="">—</option>
                <option v-for="v in verticalList" :key="v.id" :value="v.id">{{ v.id }}</option>
              </select>
            </div>
            <div class="field"><label class="fl">激光配方</label>
              <select class="fi" :value="selMachining.laserPowerRecipeId" @change="updateField(`machiningRecipes.${selMachining.id}.laserPowerRecipeId`, ($event.target as HTMLSelectElement).value)">
                <option value="">—</option>
                <option v-for="l in laserList" :key="l.id" :value="l.id">{{ l.id }}</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      <!-- Horizontal list + editor -->
      <div v-if="browseMode === 'horizontal'" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">水平配方</h2>
          <div class="center-actions">
            <button class="act-sm" @click="handleNewSub('horizontal')"><span class="material-symbols-outlined">add</span></button>
            <button class="act-sm danger" @click="handleDeleteSub('horizontal')" :disabled="!selHorizontal"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="sub-items-row">
          <button v-for="item in horizontalList" :key="item.id" class="sub-item"
            :class="{ active: item.id === selectedHorizontalId }" @click="selectedHorizontalId = item.id">
            <span class="sub-item-name">{{ item.id }}</span>
          </button>
        </div>
        <section v-if="selHorizontal" class="edit-section">
          <div class="field-grid field-grid-2col">
            <div class="field"><label class="fl">开口形状</label>
              <select class="fi" :value="selHorizontal.openingShape" @change="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.openingShape`, ($event.target as HTMLSelectElement).value)">
                <option value="V型">V型</option>
                <option value="//型">//型</option>
              </select>
            </div>
            <div class="field"></div>
            <div class="field"></div>
            <div class="field"><label class="fl">角度公式 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.angleFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.angleFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">角度公式 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.angleFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.angleFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">下开口 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.lowerOpeningFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.lowerOpeningFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">下开口 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.lowerOpeningFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.lowerOpeningFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">深度补偿 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.depthCompensationFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.depthCompensationFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">深度补偿 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.depthCompensationFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.depthCompensationFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">补偿角度 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.compensationAngleFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.compensationAngleFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">补偿角度 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.compensationAngleFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.compensationAngleFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">焦距补偿</label><input class="fi" type="number" step="0.01" :value="selHorizontal.focusCompensation" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.focusCompensation`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>
        </section>
      </div>

      <!-- Vertical list + editor -->
      <div v-if="browseMode === 'vertical'" class="center-editor">
        <div class="center-header">
          <h2 class="ed-title">垂直配方</h2>
          <div class="center-actions">
            <button class="act-sm" @click="handleNewSub('vertical')"><span class="material-symbols-outlined">add</span></button>
            <button class="act-sm danger" @click="handleDeleteSub('vertical')" :disabled="!selVertical"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="sub-items-row">
          <button v-for="item in verticalList" :key="item.id" class="sub-item"
            :class="{ active: item.id === selectedVerticalId }" @click="selectedVerticalId = item.id">
            <span class="sub-item-name">{{ item.id }}</span>
          </button>
        </div>
        <section v-if="selVertical" class="edit-section">
          <!-- Top row -->
          <div class="field-grid">
            <div class="field"><label class="fl">切割轴</label>
              <select class="fi" :value="selVertical.cuttingAxis" @change="updateField(`verticalFormulaRecipes.${selVertical.id}.cuttingAxis`, ($event.target as HTMLSelectElement).value)">
                <option value="XY">XY</option>
                <option value="R">R</option>
              </select>
            </div>
            <div class="field"><label class="fl">变化%</label><input class="fi" type="number" :value="selVertical.changePercent" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.changePercent`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">X_偏移量 (mm)</label><input class="fi" type="number" step="0.001" :value="selVertical.xFeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.xFeed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">插补运行速度 (mm/s)</label><input class="fi" type="number" :value="selVertical.xSpeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.xSpeed`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>

          <!-- Edge cutting -->
          <div class="sec-sub-section">边缘切割</div>
          <div class="field-grid">
            <div class="field"><label class="fl">速度 (%)</label><input class="fi" type="number" :value="selVertical.edgeCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">次数</label><input class="fi" type="number" :value="selVertical.edgeCutting?.cutTimes" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.cutTimes`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">速量</label><input class="fi" type="number" :value="selVertical.edgeCutting?.cutSpeedNums" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.cutSpeedNums`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">变化率 K</label><input class="fi" type="number" step="0.01" :value="selVertical.edgeCutting?.change?.k" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.change.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">变化率 B</label><input class="fi" type="number" step="0.01" :value="selVertical.edgeCutting?.change?.b" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.change.b`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>

          <!-- Middle cutting -->
          <div class="sec-sub-section">中间切割</div>
          <div class="field-grid">
            <div class="field"><label class="fl">速度 (%)</label><input class="fi" type="number" :value="selVertical.middleCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">次数</label><input class="fi" type="number" :value="selVertical.middleCutting?.cutTimes" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.cutTimes`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">变化率 K</label><input class="fi" type="number" step="0.01" :value="selVertical.middleCutting?.change?.k" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.change.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">变化率 B</label><input class="fi" type="number" step="0.01" :value="selVertical.middleCutting?.change?.b" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.change.b`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>

          <!-- Descent cutting -->
          <div class="sec-sub-section">下降切割</div>
          <div class="field-grid">
            <div class="field"><label class="fl">下降量 (mm/层)</label><input class="fi" type="number" step="0.001" :value="selVertical.descentCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">下降减少量 (mm/%)</label><input class="fi" type="number" step="0.001" :value="selVertical.descentCutting?.zFeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.zFeed`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"></div>
            <div class="field"><label class="fl">变化率 K</label><input class="fi" type="number" step="0.01" :value="selVertical.descentCutting?.change?.k" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.change.k`, Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="field"><label class="fl">变化率 B</label><input class="fi" type="number" step="0.01" :value="selVertical.descentCutting?.change?.b" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.change.b`, Number(($event.target as HTMLInputElement).value))" /></div>
          </div>
        </section>
      </div>

      <!-- Empty state -->
      <div v-if="browseMode === 'main' && !selectedRecipe" class="editor-empty">
        <span class="material-symbols-outlined ee-icon">science</span>
        <span>选择或新建一个配方</span>
      </div>
    </div>

    <!-- RIGHT TOOLBAR — quick nav to sub-recipe types -->
    <aside class="recipe-toolbar">
      <span class="tb-label">配方类型</span>
      <button class="tb-btn" :class="{ on: browseMode === 'main' }" @click="browseMode = 'main'">
        <span class="material-symbols-outlined">description</span>主配方
      </button>
      <button class="tb-btn" :class="{ on: browseMode === 'laser' }" @click="browseMode = 'laser'">
        <span class="material-symbols-outlined">bolt</span>激光功率
        <span class="tb-count">{{ laserList.length }}</span>
      </button>
      <button class="tb-btn" :class="{ on: browseMode === 'blackening' }" @click="browseMode = 'blackening'">
        <span class="material-symbols-outlined">ink_eraser</span>扫黑配方
        <span class="tb-count">{{ blackeningList.length }}</span>
      </button>
      <button class="tb-btn" :class="{ on: browseMode === 'machining' }" @click="browseMode = 'machining'">
        <span class="material-symbols-outlined">precision_manufacturing</span>加工配方
        <span class="tb-count">{{ machiningList.length }}</span>
      </button>
      <button class="tb-btn" :class="{ on: browseMode === 'horizontal' }" @click="browseMode = 'horizontal'">
        <span class="material-symbols-outlined">horizontal_rule</span>水平配方
        <span class="tb-count">{{ horizontalList.length }}</span>
      </button>
      <button class="tb-btn" :class="{ on: browseMode === 'vertical' }" @click="browseMode = 'vertical'">
        <span class="material-symbols-outlined">vertical_align_bottom</span>垂直配方
        <span class="tb-count">{{ verticalList.length }}</span>
      </button>
    </aside>
  </div>
</template>

<style scoped>
.recipes-page { display: flex; flex: 1; overflow: hidden; }

/* ---- LEFT SIDEBAR ---- */
.recipe-sidebar {
  width: 280px; background: var(--color-surface-container-low);
  border-right: 1px solid var(--color-outline-variant);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar-head { padding: 10px; }
.search-box { position: relative; margin-bottom: 6px; }
.search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-outline); font-size: 15px; }
.search-input {
  width: 100%; background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant); border-radius: 4px;
  padding: 6px 8px 6px 32px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-on-surface);
}
.search-input:focus { outline: none; border-color: var(--color-primary); }
.sidebar-actions { display: flex; gap: 3px; }
.act-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 3px;
  padding: 5px 3px; background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant); border-radius: 4px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-on-surface-variant);
  transition: background 0.15s;
}
.act-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.act-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.act-btn .material-symbols-outlined { font-size: 15px; }
.act-btn.danger:hover:not(:disabled) { background: rgba(220,38,38,0.15); color: var(--color-error); }

.recipe-list { flex: 1; overflow-y: auto; padding: 0 6px 6px; }
.recipe-item {
  width: 100%; text-align: left; padding: 10px; border: none;
  border-left: 3px solid transparent; border-radius: 0 4px 4px 0;
  background: none; cursor: pointer; margin-bottom: 1px; transition: background 0.15s;
}
.recipe-item:hover { background: var(--color-surface-variant); }
.recipe-item.active { background: rgba(73,76,80,0.35); border-left-color: var(--color-primary); }
.ri-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.ri-name { font-size: 13px; font-weight: 600; color: var(--color-on-surface); }
.ri-status {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 1px 5px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.ri-status.active { background: rgba(34,197,94,0.15); color: #22c55e; }
.ri-status.draft { background: rgba(255,182,149,0.15); color: var(--color-tertiary); }
.ri-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-outline); }

.recipe-empty { padding: 20px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--color-on-surface-variant); }
.empty-icon { font-size: 32px; opacity: 0.4; }
.empty-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.5; }

.sidebar-foot { padding: 10px; border-top: 1px solid var(--color-outline-variant); display: flex; flex-direction: column; gap: 4px; }
.save-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border: 1px solid var(--color-outline-variant); border-radius: 4px;
  background: var(--color-surface-container-high); cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
  color: var(--color-on-surface-variant); transition: all 0.2s;
}
.save-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.save-btn.pulse { border-color: var(--color-primary); color: var(--color-primary); animation: save-pulse 1.5s ease-in-out infinite; }
@keyframes save-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(173,199,255,0); } 50% { box-shadow: 0 0 8px 2px rgba(173,199,255,0.25); } }
.status-msg { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-primary); text-align: center; }
.status-msg.dim { color: var(--color-on-surface-variant); }

/* ---- CENTER ---- */
.recipe-center { flex: 1; overflow-y: auto; }
.center-editor { padding: 28px 36px; max-width: 960px; }
.center-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-outline-variant); padding-bottom: 12px; margin-bottom: 16px; }
.ed-title { font-size: 24px; font-weight: 700; color: var(--color-on-surface); display: flex; align-items: center; gap: 8px; }
.ed-id { font-weight: 300; color: var(--color-outline); font-size: 16px; font-family: 'JetBrains Mono', monospace; }
.ed-title-input { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; background: none; border: none; border-bottom: 2px solid var(--color-primary); color: var(--color-on-surface); outline: none; width: 220px; }
.center-actions { display: flex; gap: 4px; }
.act-sm {
  display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  background: var(--color-surface-container-high); border: 1px solid var(--color-outline-variant);
  border-radius: 4px; cursor: pointer; color: var(--color-on-surface-variant);
  transition: background 0.15s;
}
.act-sm:hover:not(:disabled) { background: var(--color-surface-variant); }
.act-sm:disabled { opacity: 0.35; cursor: not-allowed; }
.act-sm .material-symbols-outlined { font-size: 16px; }
.act-sm.danger:hover:not(:disabled) { background: rgba(220,38,38,0.15); color: var(--color-error); }

/* sub-item pills row */
.sub-items-row {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;
}
.sub-item {
  padding: 5px 12px; background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant); border-radius: 4px;
  cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--color-on-surface-variant); transition: all 0.15s;
}
.sub-item:hover { background: var(--color-surface-variant); }
.sub-item.active { border-color: var(--color-primary); color: var(--color-primary); background: rgba(173,199,255,0.08); }
.sub-item-name { white-space: nowrap; }

/* ---- editor common ---- */
.edit-section { animation: fadein 0.12s ease-out; }
.sec-sub-section {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
  color: var(--color-tertiary); text-transform: uppercase; letter-spacing: 0.06em;
  margin-top: 16px; margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,182,149,0.2);
}
@keyframes fadein { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
.field-grid-2col {
  grid-template-columns: 1fr 1fr;
}
.field-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 18px; }
.field { display: flex; flex-direction: column; gap: 3px; }
.fl { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.03em; }
.fi {
  padding: 6px 8px; background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant); border-radius: 4px;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--color-on-surface); outline: none;
}
.fi:focus { border-color: var(--color-primary); }
.fi.mono { font-size: 11px; }
select.fi { cursor: pointer; appearance: none; -webkit-appearance: none; }
.editor-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--color-on-surface-variant); opacity: 0.5; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
.ee-icon { font-size: 44px; }

/* ---- RIGHT TOOLBAR ---- */
.recipe-toolbar {
  width: 180px; background: var(--color-surface-container-low);
  border-left: 1px solid var(--color-outline-variant);
  padding: 14px 10px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0;
}
.tb-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 6px 8px;
}
.tb-btn {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: none; border: 1px solid transparent; border-radius: 4px;
  cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--color-on-surface-variant); text-align: left;
  transition: all 0.15s;
}
.tb-btn:hover { background: var(--color-surface-variant); }
.tb-btn.on {
  border-color: var(--color-outline-variant); background: var(--color-surface-container-high);
  color: var(--color-primary); font-weight: 600;
}
.tb-btn .material-symbols-outlined { font-size: 18px; flex-shrink: 0; }
.tb-count {
  margin-left: auto; font-size: 10px; padding: 1px 6px;
  background: var(--color-surface-container-highest); border-radius: 3px; color: var(--color-outline);
}
.tb-btn.on .tb-count { background: rgba(173,199,255,0.12); color: var(--color-primary); }

/* ---- DIALOG ---- */
.dlg-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.dlg-card {
  background: var(--color-surface-container-highest); border: 1px solid var(--color-outline-variant);
  border-radius: 8px; padding: 24px; display: flex; flex-direction: column; gap: 14px; min-width: 320px;
}
.dlg-title { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: var(--color-on-surface); }
.dlg-input {
  padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-outline-variant);
  border-radius: 4px; color: var(--color-on-surface); font-family: 'JetBrains Mono', monospace; font-size: 14px; outline: none;
}
.dlg-input:focus { border-color: var(--color-primary); }
.dlg-btns { display: flex; gap: 8px; justify-content: flex-end; }
.dlg-ok {
  padding: 6px 20px; background: var(--color-primary); color: var(--color-on-primary);
  border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; cursor: pointer;
}
.dlg-cancel {
  padding: 6px 20px; background: var(--color-surface-variant); color: var(--color-on-surface);
  border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; cursor: pointer;
}
</style>
