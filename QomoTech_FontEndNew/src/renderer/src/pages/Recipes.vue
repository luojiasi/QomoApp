<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useL10n } from '../shared/l10n'
import { useRecipes } from '../shared/recipe'
import type { MainRecipe } from '../shared/recipe'

const { t } = useL10n()
const {
  state, mainRecipes, selectedMainRecipeId, selectedRecipe, loading, dirty, lastError,
  load, save, selectRecipe, updateField
} = useRecipes()

const activeTab = ref<'main' | 'laser' | 'blackening' | 'machining' | 'horizontal' | 'vertical'>('main')
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
const hasSelection = computed(() => !!selectedRecipe.value)
const selBlackening = computed(() => hasSelection.value ? findById(state.value.blackeningRecipes ?? [], selectedRecipe.value!.blackeningRecipeId) : undefined)
const selMachining = computed(() => hasSelection.value ? findById(state.value.machiningRecipes ?? [], selectedRecipe.value!.machiningRecipeId) : undefined)
const selMachLaser = computed(() => selMachining.value ? findById(state.value.laserPowerRecipes ?? [], selMachining.value.laserPowerRecipeId) : undefined)
const selBlackLaser = computed(() => selBlackening.value ? findById(state.value.laserPowerRecipes ?? [], selBlackening.value.laserPowerRecipeId) : undefined)
const selHorizontal = computed(() => selMachining.value ? findById(state.value.horizontalFormulaRecipes ?? [], selMachining.value.horizontalFormulaId) : undefined)
const selVertical = computed(() => selMachining.value ? findById(state.value.verticalFormulaRecipes ?? [], selMachining.value.verticalFormulaId) : undefined)

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

    <!-- SIDEBAR -->
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
        <button v-for="r in filteredRecipes" :key="r.id" class="recipe-item" :class="{ active: r.id === selectedMainRecipeId }" @click="selectRecipe(r.id)">
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

    <!-- EDITOR -->
    <div class="recipe-editor">
      <div v-if="!selectedRecipe" class="editor-empty">
        <span class="material-symbols-outlined ee-icon">science</span>
        <span>选择或新建一个配方</span>
      </div>
      <div v-else class="editor-inner">
        <div class="editor-header">
          <div>
            <h2 class="ed-title">
              <input v-if="editingMainId === selectedMainRecipeId" :value="selectedRecipe.name" class="ed-title-input"
                @input="updateMainField('name', ($event.target as HTMLInputElement).value)"
                @blur="editingMainId = null" @keydown.enter="editingMainId = null" />
              <span v-else @dblclick="editingMainId = selectedMainRecipeId">{{ selectedRecipe.name }}</span>
              <span class="ed-id">{{ selectedRecipe.id }}</span>
            </h2>
          </div>
          <div class="editor-toolbar">
            <button class="tbar-btn" :class="{ on: activeTab === 'main' }" @click="activeTab = 'main'">主配方</button>
            <button class="tbar-btn" :class="{ on: activeTab === 'machining' }" @click="activeTab = 'machining'">加工</button>
            <button class="tbar-btn" :class="{ on: activeTab === 'blackening' }" @click="activeTab = 'blackening'">扫黑</button>
            <button class="tbar-btn" :class="{ on: activeTab === 'laser' }" @click="activeTab = 'laser'">激光</button>
            <button class="tbar-btn" :class="{ on: activeTab === 'horizontal' }" @click="activeTab = 'horizontal'">水平</button>
            <button class="tbar-btn" :class="{ on: activeTab === 'vertical' }" @click="activeTab = 'vertical'">垂直</button>
          </div>
        </div>

        <!-- MAIN tab -->
        <section v-show="activeTab === 'main'" class="edit-section">
          <div class="field-grid">
            <div class="field"><label class="fl">名称</label><input class="fi" :value="selectedRecipe.name" @input="updateMainField('name', ($event.target as HTMLInputElement).value)" /></div>
            <div class="field"><label class="fl">状态</label><select class="fi" :value="selectedRecipe.status" @change="updateMainField('status', ($event.target as HTMLSelectElement).value)"><option value="active">active</option><option value="draft">draft</option></select></div>
            <div class="field"><label class="fl">扫黑配方 ID</label><input class="fi mono" :value="selectedRecipe.blackeningRecipeId" @input="updateMainField('blackeningRecipeId', ($event.target as HTMLInputElement).value)" /></div>
            <div class="field"><label class="fl">加工配方 ID</label><input class="fi mono" :value="selectedRecipe.machiningRecipeId" @input="updateMainField('machiningRecipeId', ($event.target as HTMLInputElement).value)" /></div>
          </div>
        </section>

        <!-- MACHINING tab -->
        <section v-show="activeTab === 'machining'" class="edit-section">
          <template v-if="selMachining">
            <div class="sec-sub">{{ selMachining.id }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">水平公式 ID</label><input class="fi mono" :value="selMachining.horizontalFormulaId" @input="updateField(`machiningRecipes.${selMachining.id}.horizontalFormulaId`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">垂直公式 ID</label><input class="fi mono" :value="selMachining.verticalFormulaId" @input="updateField(`machiningRecipes.${selMachining.id}.verticalFormulaId`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">激光配方 ID</label><input class="fi mono" :value="selMachining.laserPowerRecipeId" @input="updateField(`machiningRecipes.${selMachining.id}.laserPowerRecipeId`, ($event.target as HTMLInputElement).value)" /></div>
            </div>
          </template>
          <div v-else class="empty-note">未关联加工配方</div>
        </section>

        <!-- BLACKENING tab -->
        <section v-show="activeTab === 'blackening'" class="edit-section">
          <template v-if="selBlackening">
            <div class="sec-sub">{{ selBlackening.id }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">启用</label><select class="fi" :value="selBlackening.enabled" @change="updateField(`blackeningRecipes.${selBlackening.id}.enabled`, ($event.target as HTMLSelectElement).value === 'true')"><option :value="true">是</option><option :value="false">否</option></select></div>
              <div class="field"><label class="fl">下降步长</label><input class="fi" type="number" step="0.01" :value="selBlackening.descentStep" @input="updateField(`blackeningRecipes.${selBlackening.id}.descentStep`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">下降次数</label><input class="fi" type="number" :value="selBlackening.descentCount" @input="updateField(`blackeningRecipes.${selBlackening.id}.descentCount`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">扫黑速度</label><input class="fi" type="number" :value="selBlackening.blackeningSpeed" @input="updateField(`blackeningRecipes.${selBlackening.id}.blackeningSpeed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">扫黑步长</label><input class="fi" type="number" step="0.001" :value="selBlackening.blackeningStep" @input="updateField(`blackeningRecipes.${selBlackening.id}.blackeningStep`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">焦距补偿</label><input class="fi" type="number" :value="selBlackening.jiaojubuchang" @input="updateField(`blackeningRecipes.${selBlackening.id}.jiaojubuchang`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">激光配方 ID</label><input class="fi mono" :value="selBlackening.laserPowerRecipeId" @input="updateField(`blackeningRecipes.${selBlackening.id}.laserPowerRecipeId`, ($event.target as HTMLInputElement).value)" /></div>
            </div>
          </template>
          <div v-else class="empty-note">未关联扫黑配方</div>
        </section>

        <!-- LASER tab -->
        <section v-show="activeTab === 'laser'" class="edit-section">
          <template v-if="selBlackLaser">
            <div class="sec-sub">扫黑激光 · {{ selBlackLaser.id }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">厂家</label><input class="fi mono" :value="selBlackLaser.laserManufacturer" @input="updateField(`laserPowerRecipes.${selBlackLaser.id}.laserManufacturer`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">功率 (W)</label><input class="fi" type="number" :value="selBlackLaser.laserPower" @input="updateField(`laserPowerRecipes.${selBlackLaser.id}.laserPower`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">频率 (Hz)</label><input class="fi" type="number" :value="selBlackLaser.laserFrequency" @input="updateField(`laserPowerRecipes.${selBlackLaser.id}.laserFrequency`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">电流 (A)</label><input class="fi" type="number" :value="selBlackLaser.laserCurrent" @input="updateField(`laserPowerRecipes.${selBlackLaser.id}.laserCurrent`, Number(($event.target as HTMLInputElement).value))" /></div>
            </div>
          </template>
          <template v-if="selMachLaser && selMachLaser.id !== selBlackLaser?.id">
            <div class="sec-sub" style="margin-top:16px">加工激光 · {{ selMachLaser.id }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">厂家</label><input class="fi mono" :value="selMachLaser.laserManufacturer" @input="updateField(`laserPowerRecipes.${selMachLaser.id}.laserManufacturer`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">功率 (W)</label><input class="fi" type="number" :value="selMachLaser.laserPower" @input="updateField(`laserPowerRecipes.${selMachLaser.id}.laserPower`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">频率 (Hz)</label><input class="fi" type="number" :value="selMachLaser.laserFrequency" @input="updateField(`laserPowerRecipes.${selMachLaser.id}.laserFrequency`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">电流 (A)</label><input class="fi" type="number" :value="selMachLaser.laserCurrent" @input="updateField(`laserPowerRecipes.${selMachLaser.id}.laserCurrent`, Number(($event.target as HTMLInputElement).value))" /></div>
            </div>
          </template>
          <div v-if="!selBlackLaser && !selMachLaser" class="empty-note">未关联激光配方</div>
        </section>

        <!-- HORIZONTAL tab -->
        <section v-show="activeTab === 'horizontal'" class="edit-section">
          <template v-if="selHorizontal">
            <div class="sec-sub">{{ selHorizontal.id }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">开口形状</label><input class="fi" :value="selHorizontal.openingShape" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.openingShape`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">角度公式 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.angleFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.angleFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">角度公式 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.angleFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.angleFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">下开口 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.lowerOpeningFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.lowerOpeningFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">下开口 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.lowerOpeningFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.lowerOpeningFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">深度补偿 K</label><input class="fi" type="number" step="0.01" :value="selHorizontal.depthCompensationFormula?.k" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.depthCompensationFormula.k`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">深度补偿 B</label><input class="fi" type="number" step="0.01" :value="selHorizontal.depthCompensationFormula?.b" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.depthCompensationFormula.b`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">焦距补偿</label><input class="fi" type="number" step="0.01" :value="selHorizontal.focusCompensation" @input="updateField(`horizontalFormulaRecipes.${selHorizontal.id}.focusCompensation`, Number(($event.target as HTMLInputElement).value))" /></div>
            </div>
          </template>
          <div v-else class="empty-note">未关联水平配方</div>
        </section>

        <!-- VERTICAL tab -->
        <section v-show="activeTab === 'vertical'" class="edit-section">
          <template v-if="selVertical">
            <div class="sec-sub">{{ selVertical.id }} · {{ selVertical.cuttingAxis }}</div>
            <div class="field-grid">
              <div class="field"><label class="fl">切割轴</label><input class="fi" :value="selVertical.cuttingAxis" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.cuttingAxis`, ($event.target as HTMLInputElement).value)" /></div>
              <div class="field"><label class="fl">变化%</label><input class="fi" type="number" :value="selVertical.changePercent" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.changePercent`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">X 进给</label><input class="fi" type="number" step="0.001" :value="selVertical.xFeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.xFeed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">X 速度</label><input class="fi" type="number" :value="selVertical.xSpeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.xSpeed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">切边速度</label><input class="fi" type="number" :value="selVertical.edgeCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">切边次数</label><input class="fi" type="number" :value="selVertical.edgeCutting?.cutTimes" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.edgeCutting.cutTimes`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">中切速度</label><input class="fi" type="number" :value="selVertical.middleCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">中切次数</label><input class="fi" type="number" :value="selVertical.middleCutting?.cutTimes" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.middleCutting.cutTimes`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">下降速度</label><input class="fi" type="number" step="0.001" :value="selVertical.descentCutting?.speed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.speed`, Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="field"><label class="fl">Z 下降进给</label><input class="fi" type="number" step="0.001" :value="selVertical.descentCutting?.zFeed" @input="updateField(`verticalFormulaRecipes.${selVertical.id}.descentCutting.zFeed`, Number(($event.target as HTMLInputElement).value))" /></div>
            </div>
          </template>
          <div v-else class="empty-note">未关联垂直配方</div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipes-page { display: flex; flex: 1; overflow: hidden; }

/* ---- SIDEBAR ---- */
.recipe-sidebar {
  width: 300px; background: var(--color-surface-container-low);
  border-right: 1px solid var(--color-outline-variant);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar-head { padding: 12px; }
.search-box { position: relative; margin-bottom: 8px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-outline); font-size: 16px; }
.search-input {
  width: 100%; background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant); border-radius: 4px;
  padding: 7px 8px 7px 36px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--color-on-surface);
}
.search-input:focus { outline: none; border-color: var(--color-primary); }
.sidebar-actions { display: flex; gap: 4px; }
.act-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 4px; background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant); border-radius: 4px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-on-surface-variant);
  transition: background 0.15s;
}
.act-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.act-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.act-btn .material-symbols-outlined { font-size: 16px; }
.act-btn.danger:hover:not(:disabled) { background: rgba(220,38,38,0.15); color: var(--color-error); }

.recipe-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.recipe-item {
  width: 100%; text-align: left; padding: 12px; border: none;
  border-left: 3px solid transparent; border-radius: 0 4px 4px 0;
  background: none; cursor: pointer; margin-bottom: 2px; transition: background 0.15s;
}
.recipe-item:hover { background: var(--color-surface-variant); }
.recipe-item.active { background: rgba(73,76,80,0.35); border-left-color: var(--color-primary); }
.ri-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.ri-name { font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
.ri-status {
  font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 1px 6px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.ri-status.active { background: rgba(34,197,94,0.15); color: #22c55e; }
.ri-status.draft { background: rgba(255,182,149,0.15); color: var(--color-tertiary); }
.ri-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-outline); }

.recipe-empty { padding: 24px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--color-on-surface-variant); }
.empty-icon { font-size: 36px; opacity: 0.4; }
.empty-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; opacity: 0.5; }

.sidebar-foot { padding: 12px; border-top: 1px solid var(--color-outline-variant); display: flex; flex-direction: column; gap: 6px; }
.save-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px; border: 1px solid var(--color-outline-variant); border-radius: 4px;
  background: var(--color-surface-container-high); cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;
  color: var(--color-on-surface-variant); transition: all 0.2s;
}
.save-btn:hover:not(:disabled) { background: var(--color-surface-variant); }
.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.save-btn.pulse { border-color: var(--color-primary); color: var(--color-primary); animation: save-pulse 1.5s ease-in-out infinite; }
@keyframes save-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(173,199,255,0); } 50% { box-shadow: 0 0 8px 2px rgba(173,199,255,0.25); } }
.status-msg { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--color-primary); text-align: center; }
.status-msg.dim { color: var(--color-on-surface-variant); }

/* ---- EDITOR ---- */
.recipe-editor { flex: 1; background: var(--color-background); overflow-y: auto; }
.editor-inner { padding: 32px 40px; max-width: 1000px; }
.editor-empty {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--color-on-surface-variant); opacity: 0.5; font-family: 'JetBrains Mono', monospace; font-size: 14px;
}
.ee-icon { font-size: 48px; }
.editor-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--color-outline-variant); padding-bottom: 14px; margin-bottom: 24px; }
.ed-title { font-size: 28px; font-weight: 700; color: var(--color-on-surface); display: flex; align-items: center; gap: 10px; }
.ed-id { font-weight: 300; color: var(--color-outline); font-size: 18px; font-family: 'JetBrains Mono', monospace; }
.ed-title-input { font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 700; background: none; border: none; border-bottom: 2px solid var(--color-primary); color: var(--color-on-surface); outline: none; width: 260px; }
.editor-toolbar { display: flex; gap: 6px; }
.tbar-btn {
  padding: 6px 14px; border: 1px solid var(--color-outline-variant); border-radius: 4px;
  background: none; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--color-on-surface-variant); transition: all 0.15s;
}
.tbar-btn:hover { background: var(--color-surface-variant); }
.tbar-btn.on { border-color: var(--color-primary); color: var(--color-primary); background: rgba(173,199,255,0.08); }

.edit-section { animation: fadein 0.15s ease-out; }
@keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.sec-sub {
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--color-primary);
  margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--color-outline-variant);
}
.field-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px;
}
.field { display: flex; flex-direction: column; gap: 4px; }
.fl { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.04em; }
.fi {
  padding: 7px 10px; background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant); border-radius: 4px;
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--color-on-surface); outline: none;
}
.fi:focus { border-color: var(--color-primary); }
.fi.mono { font-size: 11px; }
select.fi { cursor: pointer; appearance: none; -webkit-appearance: none; }
.empty-note { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--color-on-surface-variant); opacity: 0.4; padding: 20px 0; }

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
