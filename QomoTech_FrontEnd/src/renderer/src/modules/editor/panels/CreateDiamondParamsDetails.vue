<template>
  <Teleport to="body">
    <div
      v-if="visible && diamondDetail"
      class="fixed inset-0 z-200 flex items-center justify-center bg-black/50"
    >
      <div
        class="w-[560px] max-w-[94vw] max-h-[85vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-lg shadow-black/40"
        @click.stop
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="text-2xl font-semibold text-slate-100">钻石参数详情</div>
          <div class="grid grid-cols-2 gap-2 text-2xl">
            <button
            type="button"
            class="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1 text-slate-200 hover:bg-slate-800"
            @click="emit('close')"
          >
            关闭
          </button>
          <button
            type="button"
            class="rounded-md border border-red-700 bg-red-800/40 px-2 py-1  text-slate-200 hover:bg-red-800"
            @click="handleConfirm"
          >
            确定参数
          </button>
          </div>

        </div>

        <div class="grid grid-cols-3 gap-2 text-lg">
          <!-- <label class="flex flex-col gap-1 text-slate-300">
            ID
            <input
              :value="diamondDetail.id"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="text"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            名称
            <input
              :value="diamondDetail.name"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="text"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
          </label> -->
          <label class="flex flex-col gap-1 text-slate-300">
            R (克拉)
            <div class="flex flex-row gap-1">
              <input
                v-model.number="diamondDetail.R"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
              />
              <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">ct</span>
            </div>

          </label>

          <label class="flex flex-col gap-1 text-slate-300">
            P
            <div class="flex flex-row gap-1">

              <input
                v-model.number="diamondDetail.P"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
              />
              <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">ct</span>
            </div>

          </label>
          <label class="flex flex-col gap-1 text-slate-300">
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            L (长度)
            <div class="flex flex-row gap-1">
              <input
                v-model.number="diamondDetail.L"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
              />
              <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">mm</span>
            </div>
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            W (宽度)
            <div class="flex flex-row gap-1">
              <input
                v-model.number="diamondDetail.W"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
              />
              <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">mm</span>
            </div>
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            L/W (长宽比)
            <div class="flex flex-row gap-1">
              <input
                :value="calculatedLW"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
                readonly
              />
            <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;"></span>
            </div>
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            Tilt (倾斜)
            <div class="flex flex-row gap-1">

              <input
                :value="diamondDetail.Tilt"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
                readonly
              />
              <span class="text-slate-300 text-xl font-bold">°</span>
            </div>
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            SW
            <input
              :value="diamondDetail.SW"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            Yield(利用率)
            <div class="flex flex-row gap-1">
              <input
                v-model.number="diamondDetail.Yield"
                class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                type="number"
              />
              <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">%</span>
            </div>
          </label>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div
            v-for="group in ratioGroups"
            :key="group.key"
            class="rounded-md border border-slate-700 bg-slate-950/60 p-2"
          >
            <div v-if="group.key === 'Crown' || group.key === 'Pavilion'" class="mb-2 text-slate-100 text-2xl">{{ group.label }} {{ getSurfaceHeight(group) }}</div>
            <div v-else  class="mb-2 text-slate-100 text-2xl">{{ group.label }} </div>
            <div class="flex flex-col gap-2">
              <label class="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-slate-300 text-sm">
                <span class="whitespace-nowrap">实际比例：</span>
                <div class="flex flex-row gap-1">
                  <input
                    :value="displayGroupFieldValue(group, 'Ratio')"
                    class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                    type="number"
                    @focus="startGroupFieldEdit(group, 'Ratio')"
                    @input="onGroupFieldInput"
                    @keydown.enter.prevent="commitGroupFieldEdit(group, 'Ratio')"
                    @blur="commitGroupFieldEdit(group, 'Ratio')"
                    :readonly="group.readonly"
                  />
                  <span class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">%</span>
                </div>

              </label>
              <label class="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-slate-300 text-sm">
                <span class="whitespace-nowrap">实际尺寸：</span>
                <div class="flex flex-row gap-1">
                  <input
                    :value="displayGroupFieldValue(group, 'Real')"
                    class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                    type="number"
                    @focus="startGroupFieldEdit(group, 'Real')"
                    @input="onGroupFieldInput"
                    @keydown.enter.prevent="commitGroupFieldEdit(group, 'Real')"
                    @blur="commitGroupFieldEdit(group, 'Real')"
                    :readonly="group.readonly"
                  />
                  <span v-if="group.unit === 'mm'" class="text-slate-300 text-xl font-bold" style="margin-top: 10px;">mm</span>
                  <span v-else-if="group.unit === '°'" class="text-slate-300 text-xl font-bold" >°</span>
                </div>

              </label>
              <div class="text-[11px] leading-4 text-slate-400">
                {{ getGroupFormulaHint(group) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DiamondDetailParameters } from '../diamondTypes'

const props = defineProps<{
  visible: boolean
  diamondDetail: DiamondDetailParameters | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: DiamondDetailParameters): void
}>()
const ratioGroups = computed(() => {
  if (!props.diamondDetail) return []
  return [
    { key: 'Table', label: 'Table 台面', value: props.diamondDetail.Table,unit: 'mm', readonly: false },
    { key: 'Girdle', label: 'Girdle 腰面', value: props.diamondDetail.Girdle,unit: 'mm', readonly: false },
    { key: 'Crown', label: 'Crown 冠面', value: props.diamondDetail.Crown,unit: '°', readonly: false },
    { key: 'Pavilion', label: 'Pavilion 亭面', value: props.diamondDetail.Pavilion,unit: '°', readonly: false },
    { key: 'Depth', label: 'Depth 全深', value: props.diamondDetail.Depth,unit: 'mm', readonly: true }
  ]
})

// 获取直径
const getDiamondDiameter = () => {
  const length = Number(props.diamondDetail?.L ?? 0)
  const width = Number(props.diamondDetail?.W ?? 0)
  if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
    return (length + width) / 2
  }
  if (Number.isFinite(width) && width > 0) return width
  if (Number.isFinite(length) && length > 0) return length
  return 0
}


// 计算长宽比
const calculatedLW = computed(() => {
  if (!props.diamondDetail) return 0
  const width = Number(props.diamondDetail.W)
  const length = Number(props.diamondDetail.L)
  if (!Number.isFinite(width) || width === 0) return 0
  if (!Number.isFinite(length)) return 0
  return Number((length / width).toFixed(4))
})

watch(calculatedLW, (nextLW) => {
  if (!props.diamondDetail) return
  props.diamondDetail.LW = nextLW
})


// 计算全深比

type RatioField = 'Ratio' | 'Real'

const activeEditToken = ref<string | null>(null)// 当前正在编辑哪个字段
const activeDraftValue = ref('')// 该字段正在输入的临时文本

const roundTo4 = (value: number) => Number(value.toFixed(4))
const getFieldToken = (groupKey: string, field: RatioField) => `${groupKey}:${field}`
const toRadians = (deg: number) => (deg * Math.PI) / 180
const toDegrees = (rad: number) => (rad * 180) / Math.PI

const ratioToLength = (ratio: number, diameter: number) => roundTo4((ratio / 100) * diameter)
const lengthToRatio = (length: number, diameter: number) => roundTo4((length / diameter) * 100)

const getSurfaceHeight = (group: (typeof ratioGroups.value)[number]) => {
  const diameter = getDiamondDiameter()
  if (diameter <= 0) return 0
  if (group.key === 'Crown' || group.key === 'Pavilion') {
    return ratioToLength(Number(group.value.Ratio ?? 0), diameter)
  }
  return 0
}


const crownAngleFromRatio = (crownRatio: number, tableLength: number, diameter: number) => {
  const crownRatioFraction = crownRatio / 100
  const denominator = (diameter - tableLength) / 2
  if (!Number.isFinite(crownRatioFraction) || !Number.isFinite(denominator) || denominator <= 0) return 0
  const tanValue = (crownRatioFraction * diameter) / denominator
  return roundTo4(toDegrees(Math.atan(tanValue)))
}
const crownRatioFromAngle = (crownAngle: number, tableLength: number, diameter: number) => {
  const halfTableGap = (diameter - tableLength) / 2
  if (!Number.isFinite(halfTableGap) || halfTableGap <= 0 || diameter <= 0) return 0
  const ratioFraction = (Math.tan(toRadians(crownAngle)) * halfTableGap) / diameter
  return roundTo4(ratioFraction * 100)
}


const pavilionAngleFromRatio = (pavilionRatio: number) =>
  roundTo4(toDegrees(Math.atan((2 * pavilionRatio) / 100)))
const pavilionRatioFromAngle = (pavilionAngle: number) =>
  roundTo4((Math.tan(toRadians(pavilionAngle)) / 2) * 100)

const displayGroupFieldValue = (group: (typeof ratioGroups.value)[number],field: RatioField) => {
  const fieldToken = getFieldToken(group.key, field)
  if (activeEditToken.value === fieldToken) return activeDraftValue.value
  const value = field === 'Ratio' ? group.value.Ratio : group.value.Real
  return Number.isFinite(value) ? String(value) : ''
}

// 获取焦点之后开始编辑的只
const startGroupFieldEdit = (group: (typeof ratioGroups.value)[number],field: RatioField) => {
  const fieldToken = getFieldToken(group.key, field)
  activeEditToken.value = fieldToken
  const value = field === 'Ratio' ? group.value.Ratio : group.value.Real
  activeDraftValue.value = Number.isFinite(value) ? String(value) : ''
}
// 输入时更新临时文本
const onGroupFieldInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  activeDraftValue.value = target.value
}

const getGroupFormulaHint = (group: (typeof ratioGroups.value)[number]) => {
  if (!props.diamondDetail) return ''
  if (group.key === 'Table') return '台宽长度 = 台宽比 × 直径 / 100'
  if (group.key === 'Girdle') return '腰厚长度 = 腰厚比 × 直径 / 100'
  if (group.key === 'Crown') return '冠高比 = tan(冠角) × ((直径-台面)/2) / 直径'
  if (group.key === 'Pavilion') return '亭深比 = tan(亭角) × (平均直径/2) / 平均直径'
  if (group.key === 'Depth') return '全深比 = 冠面+亭面+腰面+台面的比例和'
  return ''
}

// 根据冠面/亭面/腰面/台面的比例重算全深
const recalculateDepthBySurfaceRatios = () => {
  if (!props.diamondDetail) return
  const depthRatio =
    Number(props.diamondDetail.Crown.Ratio) +
    Number(props.diamondDetail.Pavilion.Ratio) +
    Number(props.diamondDetail.Girdle.Ratio)

  if (!Number.isFinite(depthRatio)) return
  props.diamondDetail.Depth.Ratio = roundTo4(depthRatio)

  const diameter = getDiamondDiameter()
  if (diameter > 0) props.diamondDetail.Depth.Real = roundTo4((props.diamondDetail.Depth.Ratio / 100) * diameter)

}
// 确认编辑时更新钻石参数
const commitGroupFieldEdit = (group: (typeof ratioGroups.value)[number],field: RatioField) => {
  const fieldToken = getFieldToken(group.key, field)
  if (activeEditToken.value !== fieldToken) return

  const parsedValue = Number(activeDraftValue.value)
  if (Number.isFinite(parsedValue)) {
    const diameter = getDiamondDiameter()
    const tableLength = Number(props.diamondDetail?.Table.Real ?? 0)
    if (group.key === 'Table' || group.key === 'Girdle' || group.key === 'Depth') {
      if (field === 'Ratio') {
        group.value.Ratio = parsedValue
        if (!group.readonly && diameter > 0) group.value.Real = ratioToLength(parsedValue, diameter)
      } else {
        group.value.Real = parsedValue
        if (!group.readonly && diameter > 0) group.value.Ratio = lengthToRatio(parsedValue, diameter)
      }
    } else if (group.key === 'Crown') {
      if (field === 'Ratio') {
        group.value.Ratio = parsedValue
        group.value.Real = crownAngleFromRatio(parsedValue, tableLength, diameter)
      } else {
        group.value.Real = parsedValue
        group.value.Ratio = crownRatioFromAngle(parsedValue, tableLength, diameter)
      }
    } else if (group.key === 'Pavilion') {
      if (field === 'Ratio') {
        group.value.Ratio = parsedValue
        group.value.Real = pavilionAngleFromRatio(parsedValue)
      } else {
        group.value.Real = parsedValue
        group.value.Ratio = pavilionRatioFromAngle(parsedValue)
      }
    }
  }
  recalculateDepthBySurfaceRatios()
// 确认编辑后清空编辑状态
  activeEditToken.value = null
  activeDraftValue.value = ''
}

const handleConfirm = () => {
  if (!props.diamondDetail) return
  emit('save', props.diamondDetail)
  emit('close')
}

</script>
