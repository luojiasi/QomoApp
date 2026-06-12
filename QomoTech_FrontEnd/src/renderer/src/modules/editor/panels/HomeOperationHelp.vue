<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CollapsiblePanelHeader from '@/shared/components/CollapsiblePanelHeader.vue'
import UseHelpContent from '@/modules/editor/panels/UseHelpContent.vue'
import RadioGroup from '@/shared/components/RadioGroup.vue'
import PositionTable from '@/shared/components/PositionTable.vue'
import { usePositionTable } from '@/shared/composables/usePositionTable'
import type { CreateFlowType } from '@/shared/composables/usePositionTable'
import { useNotification } from '@/shared/composables/useNotification'
import { useQomo5PStore } from '../useQomo5PStore'
import { storeToRefs } from 'pinia'
import type { Point, QomoArcSurfacesEntity } from '../qomo5pTypes'

const isHelpPanelExpanded = ref(true)

const { success, error } = useNotification()
const qomo5pStore = useQomo5PStore()
const { entities, selectedEntityIds, layers } = storeToRefs(qomo5pStore)
const router = useRouter()

const visibleLayerIdSet = computed(() => new Set(layers.value.filter((l) => l.visible).map((l) => l.id)))
const selectableEntities = computed(() => entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId)))
// 导入文件实体========用于导入文件
const importFileInputRef = ref<HTMLInputElement | null>(null)
const handleImportClick = () => {
  importFileInputRef.value?.click()
}
const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  const normalizedName = file.name.trim()
  const lowerName = normalizedName.toLowerCase()
  try {
    if (lowerName.endsWith('.ljs')) {
      const text = await file.text()
      qomo5pStore.importProjectFromLjs(text, normalizedName)
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }
    if (lowerName.endsWith('.dxf')) {
      const text = await file.text()
      qomo5pStore.importProjectFromDxf(text, normalizedName)
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }
    error('不支持的文件类型', '请导入 .ljs 或 .dxf 文件')
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    error('导入失败', message)
  } finally {
    if (input) input.value = ''
  }
}

// =========================================================================================
// 创建新的图像就是直接创建新的绘画然后跳转界面
const handleNewImage = async () => {
  try {
    userSelectedNone.value = true
    qomo5pStore.createNewProject(`untitled-${Date.now()}`)
    qomo5pStore.clearSelection()
    await nextTick()
    await router.push('/create-5p')
  } finally {
  }
}

const handleModifyImage = async () => {
  await router.push('/create-5p')
}

// =========================================================================================
// 创建图像的步骤
type CreateWizardStep = 'ready' | 'create' | 'choose'| 'position'
const createWizardStep = ref<CreateWizardStep>('ready')
const createWizardStepDict: Record<CreateWizardStep, { stepNo: number; text: string }> = {
  ready: { stepNo: 1, text: '准备阶段' },
  create: { stepNo: 2, text: '创建图形' },
  choose: { stepNo: 3, text: '选择类型' },
  position: { stepNo: 4, text: '精选点位'},
}
const createWizardTotalSteps = Object.keys(createWizardStepDict).length
const currentCreateStepMeta = computed(() => createWizardStepDict[createWizardStep.value])
const createWizardHeaderTitle = computed(() => `当前步骤:${currentCreateStepMeta.value.stepNo} ${currentCreateStepMeta.value.text}/${createWizardTotalSteps}步`)


const chooseOptions: { value: CreateFlowType; label: string }[] = [
  { value: 'image-process', label: '完整图像套图加工' },
  { value: 'matrix-process', label: '图像单元矩阵加工' },
]


// 上一步和下一步的功能实现
const createWizardStepOrder = (Object.keys(createWizardStepDict) as CreateWizardStep[]).sort((a, b) => createWizardStepDict[a].stepNo - createWizardStepDict[b].stepNo)
const handlePreviousStep = () => {
  const currentIndex = createWizardStepOrder.indexOf(createWizardStep.value)
  if (currentIndex <= 0) return
  createWizardStep.value = createWizardStepOrder[currentIndex - 1]
}
const handleNextStep = () => {
  const currentIndex = createWizardStepOrder.indexOf(createWizardStep.value)
  if (currentIndex < 0 || currentIndex >= createWizardStepOrder.length - 1) return
  createWizardStep.value = createWizardStepOrder[currentIndex + 1]
}
// 始终监听实体数量，自动切换步骤
watch(() => entities.value.length, (entityLen) => {entityLen > 0 ? createWizardStep.value = 'create':createWizardStep.value = 'ready'}, { immediate: true })






const { rows, addRow, removeRow, toggleEnabled, setStopPercent, recordCurrentPosition, chooseOptionsTypes } =
  usePositionTable()
// 以便 overlay 高亮 + 本卡片能显示数据。
// 默认不选中任何实体：避免切回首页时自动高亮第一个实体
const userSelectedNone = ref(true)
watch(
  () => [entities.value.length, selectedEntityIds.value.length] as const,
  ([entityLen, selectedLen]) => {
    if (entityLen > 0 && selectedLen === 0) {
      // 用户显式选择了“无”，就不要再自动选回第一个实体
      if (userSelectedNone.value) return
      const first = selectableEntities.value[0]
      if (first?.id) qomo5pStore.selectSingleEntity(first.id)
    }
  },
  { immediate: true }
)

const dropdownSelectedEntityId = computed<string>({
  get: () => selectedEntityIds.value[0] ?? '',
  set: (next) => {
    if (!next) {
      userSelectedNone.value = true
      qomo5pStore.clearSelection()
      return
    }
    userSelectedNone.value = false
    qomo5pStore.selectSingleEntity(next)
  }
})

const selectedEntity = computed(() => {
  const id = dropdownSelectedEntityId.value
  if (!id) return null
  return selectableEntities.value.find((e) => e.id === id) ?? null
})

const formatPoint = (p: { x: number; y: number }) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`
const formatPointOrDash = (p?: Point | null) =>
  p ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})` : '—'

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
const getArcStartPoint = (e: QomoArcSurfacesEntity) => e.startPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.startAngle)
const getArcEndPoint = (e: QomoArcSurfacesEntity) => e.endPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.endAngle)

</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isHelpPanelExpanded ? 'min-h-[min(250px,42vh)]' : ''"
  >
    <CollapsiblePanelHeader v-model:expanded="isHelpPanelExpanded" :title="createWizardHeaderTitle" />

    <div
      class="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs leading-relaxed text-(--app-text-secondary)"
    >
      <input
        ref="importFileInputRef"
        type="file"
        accept=".ljs,.dxf"
        class="hidden"
        @change="handleImportFileChange"
      />

      <!-- 新建图像（单独一个 card） -->
      <div v-if="currentCreateStepMeta.stepNo <= 2" class="flex items-start justify-center gap-2">
        <button
          type="button"
          class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleNewImage"
        >
          新建新图像
        </button>
        <button
          v-show="selectableEntities.length > 0"
          type="button"
          class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleModifyImage"
        >
          修改图像
        </button>
        <button
          type="button"
            class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleImportClick"
        >
          导入…
        </button>

      </div>

      <div v-if="currentCreateStepMeta.stepNo == 3" class="flex items-start justify-center gap-2">
        <RadioGroup v-model="chooseOptionsTypes" :options="chooseOptions" />
      </div>

      <div v-if="currentCreateStepMeta.stepNo == 4 && chooseOptionsTypes == 'matrix-process'" class="space-y-2">
        <PositionTable
          :rows="rows"
          @add="addRow"
          @record="recordCurrentPosition"
          @remove="removeRow"
          @toggle-enabled="toggleEnabled"
          @update-stop-percent="(id, v) => setStopPercent(id, v)"
        />
      </div>

      <div v-if="currentCreateStepMeta.stepNo >=2">
        <div class="flex items-start justify-center gap-2">
          <button
            v-if="currentCreateStepMeta.stepNo >2"
            type="button"
            class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            @click="handlePreviousStep"
          >
            上一步
          </button>
          <button
            v-if="currentCreateStepMeta.stepNo < createWizardTotalSteps"
            type="button"
            class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleNextStep"
          >
            下一步
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-2 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5" >
        <div class="mt-1">
          <div class="flex items-center gap-3" v-if="selectableEntities.length > 0">
            <select
              v-model="dropdownSelectedEntityId"
              :disabled="selectableEntities.length === 0"
              class="w-full min-w-0 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition scheme-light focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-black/40 dark:scheme-dark"
            >
              <option value="">无</option>
              <option v-for="e in selectableEntities" :key="e.id" :value="e.id">
                {{ e.type }} / {{ e.id }} / {{ e.layerName }}
              </option>
            </select>
          </div>
        </div>

        <div class="mt-1">
          <div
            v-if="selectableEntities.length === 0"
            class="min-h-[140px] rounded-md border border-dashed border-(--app-border) bg-(--app-card-soft-2) p-3 text-xs text-(--app-text-secondary)"
          >
            当前没有实体；请先新建图像或者导入 ".ljs" / ".dxf" 文件。
          </div>
          <div
            v-else-if="!selectedEntity"
            class="min-h-[140px] rounded-md border border-dashed border-(--app-border) bg-(--app-card-soft-2) p-3 text-xs text-(--app-text-secondary)"
          >
            选择实体以查看相关实体参数
          </div>
          <div
            v-else
            class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-4 text-xs text-(--app-text-secondary) shadow-inner shadow-slate-900/5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-semibold text-(--app-text-primary) truncate">
                  {{ selectedEntity.type }} / ID: {{ selectedEntity.id }}
                </div>
                <div class="mt-1 text-[11px] text-(--app-text-muted)">
                  层：{{ selectedEntity.layerName }}
                </div>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-(--app-text-muted)">
              <!-- 固定两参数：每行只放两条 -->
              <div>图形高度：{{ selectedEntity.extrudeHeight.toFixed(3) }}</div>
              <div>旋转角度：{{ selectedEntity.surfaceAngle.toFixed(3) }}</div>

              <!-- 具有起点/终点的实体：LINE / ARC / BEZIER -->
              <template v-if="selectedEntity.type === 'LINE'">
                <div class="col-span-2">起点：{{ formatPoint(selectedEntity.start) }}</div>
                <div class="col-span-2">终点：{{ formatPoint(selectedEntity.end) }}</div>
              </template>

              <template v-else-if="selectedEntity.type === 'ARC'">
                <div class="col-span-2">起点：{{ formatPointOrDash(getArcStartPoint(selectedEntity)) }}</div>
                <div class="col-span-2">终点：{{ formatPointOrDash(getArcEndPoint(selectedEntity)) }}</div>
                <div class="col-span-2">圆心：{{ formatPoint(selectedEntity.center) }}</div>
                <div class="col-span-2">半径：{{ selectedEntity.radius.toFixed(3) }}</div>
              </template>
              
              <template v-else-if="selectedEntity.type === 'CIRCLE'">
                <div class="col-span-2">圆心：{{ formatPoint(selectedEntity.center) }}</div>
                <div class="col-span-2">半径：{{ selectedEntity.radius.toFixed(3) }}</div>
              </template>

              <template v-else-if="selectedEntity.type === 'BEZIER'">
                <div class="col-span-2">
                  起点：{{
                    selectedEntity.points.length > 0 ? formatPointOrDash(selectedEntity.points[0]) : '—'
                  }}
                </div>
                <div class="col-span-2">
                  终点：
                  {{
                    selectedEntity.points.length > 0
                      ? formatPointOrDash(selectedEntity.points[selectedEntity.points.length - 1])
                      : '—'
                  }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <UseHelpContent />
    </div>
  </div>
</template>
