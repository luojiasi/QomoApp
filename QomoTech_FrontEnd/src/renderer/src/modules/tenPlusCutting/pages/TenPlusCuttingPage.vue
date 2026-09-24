<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw } from 'vue'
import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'
import {
  getTenPlusCutting,
  saveTenPlusCutting,
  moveToTenPlusSlot,
  setMotionIoOutput,
  rotateRAxisCont,
  stopMotionJog
} from '@/modules/motion/api'
import { sendTenPlusFreeParams, getTenCameraFocusError } from '@/modules/program/api'
import {
  切角比例推荐,
  曲线子类型选项,
  曲线子类型超椭圆,
  曲线路径类型,
  等分线段类型,
  网格顺序,
  线段子类型选项,
  路径类型按钮,
  工位输出口,
  是曲线,
  是等分组,
  是等分线段,
  是非等分直线,
  是超椭圆曲线,
  是台面角,
  解析曲线子类型,
  工位转输出口,
  路径类型标题
} from '../constants/tenPlusCutting'
import {
  垫型默认指数,
  快捷形状选项
} from '../constants/shapePreset'
import {
  使用十加任务,
  直径无效,
  超椭圆指数无效,
  角度无效,
  高度无效,
  台面直径为零,
  非台面高度为零,
  切角比例无效,
  弧角无效,
  分割数无效,
  配方无效,
  应用台面锁定字段,
  校验目标行,
  校验全部目标
} from '../composables/useTenPlusTask'
import {
  createEmptyTenPlusConfig,
  normalizeTenPlusConfig,
  formatPointXyz,
  parsePointXyz
} from '../utils/tenPlusConfig'
import {
  buildTenPlusRowsFromTargets,
  toTenPlusTargetSummary
} from '../utils/tenPlusPayload'
import { 生成快捷形状行 } from '../utils/shapePresets'
import { 切工标签, 生成钻石预设行 } from '../utils/diamondPresets'
import type { TenPlusCuttingConfig, TenPlusFreeParamPayload, TenPlusSlot, TenPlusTarget } from '../types/tenPlusCutting'
import type { TenPlusQuickShapeInput } from '../types/shapePreset'
import type { 钻石预设输入 } from '../types/diamondPreset'
import TenPlusCuttingPage_UrCalibDialog from '../components/TenPlusCuttingPage_UrCalibDialog.vue'
import TenPlusCuttingPage_CompDialog from '../components/TenPlusCuttingPage_CompDialog.vue'
import TenPlusCuttingPage_ShapePresetDialog from '../components/TenPlusCuttingPage_ShapePresetDialog.vue'
import TenPlusCuttingPage_DiamondPresetDialog from '../components/TenPlusCuttingPage_DiamondPresetDialog.vue'
import TenPlusCuttingPage_TourOverlay from '../components/TenPlusCuttingPage_TourOverlay.vue'
import TenPlusCuttingPage_CameraWindow from '../components/TenPlusCuttingPage_CameraWindow.vue'
import TenPlusCuttingPage_RunControls from '../components/TenPlusCuttingPage_RunControls.vue'
import { useTenPlusPageUi } from '../composables/useTenPlusPageUi'

type 工作模式类型 = '自由参数' | '画图'

const { warning, success, error } = useNotification()
const recipeStore = useRecipeSettingsStore()
const { mposition, controllerConnected } = useHardwareState()
const {
  programRunning,
  programPaused,
  programTaskCount,
  currentTaskJindubaifenbi,
  programElapsedText,
  onPauseToggleClick,
  onResetAlarmsClick,
  onEstopClick,
  onSkipTaskClick,
  noteProgramStarted,
  initSync: initProgramSync,
  cleanup: cleanupProgramRunner
} = useProgramRunner()

const {
  目标列表,
  当前目标编号,
  当前目标,
  任务行列表,
  初始化默认目标,
  新建目标,
  选择目标,
  重命名目标,
  删除目标,
  添加任务行,
  追加任务草稿,
  删除任务行,
  绑定当前目标到工位,
  导出文件,
  从文件加载
} = 使用十加任务()

const 工作模式 = ref<工作模式类型>('自由参数')
const { keyboardEnabled, cameraVisible, runCameraEnlarge } = useTenPlusPageUi()
useMotionKeyboard(keyboardEnabled)
const 重命名中的编号 = ref<string | null>(null)
const 重命名草稿 = ref('')
const 重命名输入 = ref<HTMLInputElement | null>(null)
const 文件输入 = ref<HTMLInputElement | null>(null)
const 状态文案 = ref('')
const 启动中 = ref(false)
const 流程已确认 = ref(false)
const 显示操作手册 = ref(false)
const 显示启动对话框 = ref(false)
const 对话框已选编号 = ref<string[]>([])
const 十工位配置 = ref<TenPlusCuttingConfig>(createEmptyTenPlusConfig())
const 选中工位 = ref<number | null>(null)
const 工位忙碌 = ref(false)
const R轴忙碌 = ref(false)
const R轴旋转中 = ref(false)
/** 点击已示教工位时是否运动到该点，默认开启 */
const 点击工位移动 = ref(true)
const 显示示教对话框 = ref(false)
const 示教工位 = ref<number | null>(null)
const 显示标定对话框 = ref(false)
const 标定工位 = ref<number | null>(null)
const 相机停靠工作区 = computed(
  () =>
    runCameraEnlarge.value &&
    programRunning.value &&
    工作模式.value === '自由参数' &&
    !显示标定对话框.value
)
const 显示相机窗口 = computed(
  () => !显示标定对话框.value && (相机停靠工作区.value || cameraVisible.value)
)
const 显示快捷形状 = ref(false)
const 显示钻石预设 = ref(false)
const 补偿对话框行 = ref<TenPlusTarget['rows'][number] | null>(null)

async function 打开操作手册(): Promise<void> {
  工作模式.value = '自由参数'
  if (!当前目标.value && 目标列表[0]) {
    选择目标(目标列表[0].id)
  }
  await nextTick()
  显示操作手册.value = true
}

function 打开补偿对话框(row: TenPlusTarget['rows'][number]): void {
  补偿对话框行.value = row
}

function 关闭补偿对话框(): void {补偿对话框行.value = null}

function 确保已选目标(): boolean {
  if (当前目标.value) return true
  warning('请先选择目标')
  return false
}

function 打开快捷形状(): void {
  if (!确保已选目标()) return
  显示快捷形状.value = true
}
function 关闭快捷形状(): void {显示快捷形状.value = false}

function 写入预设行(草稿: Array<Partial<TenPlusTarget['rows'][number]>>,成功: string,失败: string,关闭: () => void): void {
  try {
    追加任务草稿(草稿)
    关闭()
    success(成功)
  } catch (err) {
    warning(err instanceof Error ? err.message : 失败)
  }
}

function 确认快捷形状(input: TenPlusQuickShapeInput): void {
  const label = 快捷形状选项.find((item) => item.value === input.shape)?.label ?? '快捷形状'
  写入预设行(
    生成快捷形状行(input),
    `已将${label}写入当前目标`,
    '生成快捷形状失败',
    关闭快捷形状
  )
}

function 打开钻石预设(): void {
  if (!确保已选目标()) return
  显示钻石预设.value = true
}
function 关闭钻石预设(): void {显示钻石预设.value = false}
function 确认钻石预设(input: 钻石预设输入): void {
  写入预设行(
    生成钻石预设行(input),
    `已将${切工标签(input.切工)}（台面/冠/腰/亭）四行写入当前目标`,
    '生成钻石快捷形状失败',
    关闭钻石预设
  )
}

const 启用主配方 = computed(() =>recipeStore.recipeState.mainRecipes.filter((r) => r.status === 'active'))
function 配方标签(r: { id: string; name?: string }): string {return (r.name && r.name.trim()) || r.id}
function 格式化轴(val: number | undefined | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return val.toFixed(3)
}
function 设置状态(msg: string): void {状态文案.value = msg}
function 行角度变化(row: TenPlusTarget['rows'][number], e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  if (是台面角(v)) 应用台面锁定字段(row)
}
function 获取点位(): void {
  const target = 当前目标.value
  if (!target) return
  const x = Number(mposition.value['X'])
  const y = Number(mposition.value['Y'])
  const z = Number(mposition.value['Z'])
  if ([x, y, z].some((v) => Number.isNaN(v))) {
    warning('当前坐标无效，无法获取点位')
    return
  }
  target.pointXyz = formatPointXyz(x, y, z)
}
const 当前点位轴 = computed(() => parsePointXyz(当前目标.value?.pointXyz ?? ''))
function 添加目标(): void {
  const target = 新建目标(`目标 ${目标列表.length + 1}`)
  void 开始重命名(target.id, target.name)
}
async function 开始重命名(id: string, currentName: string): Promise<void> {
  重命名中的编号.value = id
  重命名草稿.value = currentName
  await nextTick()
  重命名输入.value?.focus()
  重命名输入.value?.select()
}
function 提交重命名(): void {
  const id = 重命名中的编号.value
  if (!id) return
  重命名目标(id, 重命名草稿.value.trim() || '未命名目标')
  重命名中的编号.value = null
  重命名草稿.value = ''
}
function 取消重命名(): void {
  重命名中的编号.value = null
  重命名草稿.value = ''
}

function 应用曲线类型(row: TenPlusTarget['rows'][number], kind: string): void {
  row.pathType = 曲线路径类型
  row.curveKind = kind
  if (kind === 曲线子类型超椭圆 && 超椭圆指数无效(row.superellipseN)) {
    row.superellipseN = 垫型默认指数
  }
}

function 路径类型变化(row: TenPlusTarget['rows'][number], pathType: string): void {
  if (是曲线(pathType)) {
    应用曲线类型(row, 解析曲线子类型(row.curveKind, row.superellipseN))
    return
  }
  if (pathType === 等分线段类型) {
    if (!是等分组(row.pathType)) {
      row.pathType = 等分线段类型
      row.sameLayer = false
    }
    return
  }
  row.pathType = pathType
  row.sameLayer = false
}

type 子类型模式类型 = 'curve' | 'line'

const 子类型行 = ref<TenPlusTarget['rows'][number] | null>(null)
const 子类型模式 = ref<子类型模式类型 | null>(null)
const 子类型位置 = ref({ top: 0, left: 0 })
const 子类型选项 = computed(() =>
  子类型模式.value === 'line' ? 线段子类型选项 : 曲线子类型选项
)
const 子类型当前值 = computed(() => {
  const row = 子类型行.value
  if (!row || !子类型模式.value) return ''
  if (子类型模式.value === 'line') {
    return 是等分组(row.pathType) ? row.pathType : 等分线段类型
  }
  return 解析曲线子类型(row.curveKind, row.superellipseN)
})
const 子类型无障碍 = computed(() =>
  子类型模式.value === 'line' ? '等分线段子类型' : '曲线子类型'
)

function 关闭子类型选择(): void {
  子类型行.value = null
  子类型模式.value = null
}

function 打开子类型选择(
  row: TenPlusTarget['rows'][number],
  mode: 子类型模式类型,
  event: MouseEvent
): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  子类型行.value = row
  子类型模式.value = mode
  子类型位置.value = { top: rect.bottom + 6, left: rect.left }
}

function 路径类型双击(
  row: TenPlusTarget['rows'][number],
  itemValue: string,
  event: MouseEvent
): void {
  if (itemValue === 曲线路径类型) {
    应用曲线类型(row, 解析曲线子类型(row.curveKind, row.superellipseN))
    打开子类型选择(row, 'curve', event)
    return
  }
  if (itemValue === 等分线段类型) {
    if (!是等分组(row.pathType)) {
      row.pathType = 等分线段类型
      row.sameLayer = false
    }
    打开子类型选择(row, 'line', event)
  }
}

function 选择子类型(value: string): void {
  const row = 子类型行.value
  if (!row || !子类型模式.value) return
  if (子类型模式.value === 'line') {
    row.pathType = value
    row.sameLayer = false
  } else {
    应用曲线类型(row, value)
  }
  关闭子类型选择()
}

function 路径按钮点亮(row: TenPlusTarget['rows'][number], itemValue: string): boolean {
  if (itemValue === 等分线段类型) return 是等分组(row.pathType)
  return row.pathType === itemValue
}

function 保存任务(): void {
  const err = 校验全部目标(目标列表)
  if (err) {
    warning(err)
    设置状态(err)
    return
  }
  导出文件()
  success('已保存任务参数文件')
  设置状态('已保存')
}

function 对话框已选(id: string): boolean {
  return 对话框已选编号.value.includes(id)
}

function 切换对话框选择(id: string, checked: boolean): void {
  const set = new Set(对话框已选编号.value)
  if (checked) set.add(id)
  else set.delete(id)
  对话框已选编号.value = 目标列表.filter((t) => set.has(t.id)).map((t) => t.id)
}

function 目标可启动(target: TenPlusTarget): boolean {
  if (target.slotIndex === null || target.slotIndex === undefined) return false
  if (!target.pointXyz || !String(target.pointXyz).trim()) return false
  if (!target.rows.length) return false
  return true
}

function 目标无法启动原因(target: TenPlusTarget): string {
  if (target.slotIndex === null || target.slotIndex === undefined) return '未绑定工位'
  if (!target.pointXyz || !String(target.pointXyz).trim()) return '无点位 XYZ'
  if (!target.rows.length) return '无任务行'
  return ''
}

const 对话框已选目标列表 = computed((): TenPlusTarget[] => {
  const map = new Map(目标列表.map((t) => [t.id, t]))
  return 对话框已选编号.value.map((id) => map.get(id)).filter((t): t is TenPlusTarget => Boolean(t))
})

const 可确认启动 = computed(() => {
  const list = 对话框已选目标列表.value
  return list.length > 0 && list.every((t) => 目标可启动(t))
})

function 开始运行(): void {
  if (启动中.value || !流程已确认.value) return
  if (目标列表.length === 0) {
    warning('没有可执行的目标')
    设置状态('没有可执行的目标')
    return
  }
  const readyIds = 目标列表.filter((t) => 目标可启动(t)).map((t) => t.id)
  if (当前目标编号.value && readyIds.includes(当前目标编号.value)) {
    对话框已选编号.value = [当前目标编号.value]
  } else {
    对话框已选编号.value = [...readyIds]
  }
  显示启动对话框.value = true
}

function 关闭启动对话框(): void {
  if (启动中.value) return
  显示启动对话框.value = false
}

async function 确认启动对话框(): Promise<void> {
  if (启动中.value || !可确认启动.value) return

  const selected = 对话框已选目标列表.value
  for (const target of selected) {
    const err = 校验目标行(target.name, target.rows)
    if (err) {
      warning(err)
      设置状态(err)
      return
    }
  }

  const summaries = selected
    .map((t) => toTenPlusTargetSummary(t))
    .filter((t): t is NonNullable<typeof t> => t !== null)
  if (summaries.length !== selected.length) {
    warning('所选目标未就绪（需绑定工位并有点位）')
    return
  }

  const slotSet = new Set<number>()
  for (const target of selected) {
    if (typeof target.slotIndex === 'number') slotSet.add(target.slotIndex)
  }
  const cameraFocusErrorBySlot = new Map<number, number>()
  for (const slot of slotSet) {
    const focusRes = await getTenCameraFocusError(slot)
    if (!focusRes.success || focusRes.data == null) {
      warning(focusRes.message || `读取工位 ${slot} 相机清晰误差失败`)
      设置状态(`读取工位 ${slot} 相机清晰误差失败`)
      return
    }
    const errorMm = Number(focusRes.data.value)
    if (!Number.isFinite(errorMm)) {
      warning(`工位 ${slot} 相机清晰误差无效`)
      设置状态(`工位 ${slot} 相机清晰误差无效`)
      return
    }
    cameraFocusErrorBySlot.set(slot, errorMm)
  }

  const recipeState = toRaw(recipeStore.recipeState)
  let payload: TenPlusFreeParamPayload
  try {
    payload = {
      recipes: {
        mainRecipes: JSON.parse(JSON.stringify(recipeState.mainRecipes ?? [])),
        machiningRecipes: JSON.parse(JSON.stringify(recipeState.machiningRecipes ?? [])),
        blackeningRecipes: JSON.parse(JSON.stringify(recipeState.blackeningRecipes ?? [])),
        laserPowerRecipes: JSON.parse(JSON.stringify(recipeState.laserPowerRecipes ?? [])),
        horizontalFormulaRecipes: JSON.parse(JSON.stringify(recipeState.horizontalFormulaRecipes ?? [])),
        verticalFormulaRecipes: JSON.parse(JSON.stringify(recipeState.verticalFormulaRecipes ?? []))
      },
      targets: summaries,
      rows: buildTenPlusRowsFromTargets(selected, cameraFocusErrorBySlot)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '下发数据不完整'
    warning(msg)
    设置状态(msg)
    return
  }

  启动中.value = true
  try {
    const res = await sendTenPlusFreeParams(payload as unknown as Record<string, unknown>)
    if (res.success) {
      const tc = typeof res.data?.task_count === 'number' ? res.data.task_count : payload.rows.length
      noteProgramStarted(tc)
      const names = summaries.map((x) => x.name).join('、')
      success(res.message || '十工位任务已启动')
      设置状态(`已启动：${summaries.length} 个目标（${names}），共 ${tc} 行`)
      显示启动对话框.value = false
    } else {
      error(res.message || '启动失败')
      设置状态(`启动失败: ${res.message || ''}`)
    }
  } catch {
    error('启动失败：无法连接后端')
    设置状态('启动失败')
  } finally {
    启动中.value = false
  }
}

function 点击加载(): void {
  文件输入.value?.click()
}

function 文件变化(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const ok = 从文件加载(reader.result as string)
    if (ok) {
      success('参数文件已加载')
      设置状态('已加载')
    } else {
      error('加载失败：文件格式不正确')
      设置状态('加载失败')
    }
  }
  reader.onerror = () => {
    error('加载失败：无法读取文件')
    设置状态('加载失败')
  }
  reader.readAsText(file)
  input.value = ''
}

function 取工位(index: number): TenPlusSlot | undefined {return 十工位配置.value.slots.find((s) => s.index === index)}

const 悬停工位 = ref<number | null>(null)
const 悬停提示位置 = ref({ top: 0, left: 0 })

const 悬停工位数据 = computed((): TenPlusSlot | undefined => {
  const idx = 悬停工位.value
  return idx === null ? undefined : 取工位(idx)
})

function 工位悬停进入(event: MouseEvent, index: number): void {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  悬停工位.value = index
  悬停提示位置.value = {
    top: rect.top - 8,
    left: rect.left + rect.width / 2
  }
}
function 工位悬停离开(): void {悬停工位.value = null}

/**
 * 第 5 列的表头：等分线段按「分割数」下刀，非等分直线的轮廓边数固定，
 * 改由「切角 (%)」决定形状，两者不会同时生效，只有混用路径类型时才并列显示。
 */
const 分割列表头 = computed((): string => {
  const rows = 任务行列表.value
  if (rows.length === 0) return '分割数'
  const labels: string[] = []
  if (rows.some((r) => 是等分线段(r.pathType))) labels.push('分割数')
  if (rows.some((r) => 是非等分直线(r.pathType))) labels.push('切角 (%)')
  if (rows.some((r) => 是曲线(r.pathType))) labels.push('起止角')
  if (labels.length > 0) return labels.join(' / ')
  return '分割数'
})

/** 只要有一行走非等分直线，表头就挂上切角比例的推荐值说明 */
const 显示切角说明 = computed((): boolean =>
  任务行列表.value.some((r) => 是非等分直线(r.pathType))
)

const 切角提示可见 = ref(false)
const 切角提示位置 = ref({ top: 0, left: 0 })

function 切角提示进入(event: Event): void {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  切角提示位置.value = {
    top: rect.top - 8,
    left: rect.left + rect.width / 2
  }
  切角提示可见.value = true
}

function 切角提示离开(): void {
  切角提示可见.value = false
}

function 绑定目标名(slotIndex: number): string {
  const hit = 目标列表.find((t) => t.slotIndex === slotIndex)
  return hit?.name?.trim() || ''
}

function 工位格样式(index: number): Record<string, boolean> {
  const slot = 取工位(index)
  const taught = Boolean(slot?.taught)
  const isBound = 当前目标.value?.slotIndex === index
  const isSelected = 选中工位.value === index
  return {
    'slot-taught': taught,
    'slot-empty': !taught,
    'slot-bound': isBound,
    'slot-selected': isSelected && !isBound
  }
}

async function 加载十工位配置(): Promise<void> {
  const res = await getTenPlusCutting()
  if (res.success && res.data) {
    十工位配置.value = normalizeTenPlusConfig(res.data)
  } else {
    十工位配置.value = createEmptyTenPlusConfig()
  }
}

async function 保存十工位配置(): Promise<boolean> {
  const res = await saveTenPlusCutting(十工位配置.value)
  if (!res.success) {
    error(res.message || '十工位配置保存失败')
    设置状态(res.message || '十工位配置保存失败')
    return false
  }
  if (res.data) {
    十工位配置.value = normalizeTenPlusConfig(res.data)
  }
  return true
}

async function 打开工位输出口(slotIndex: number): Promise<void> {
  if (!controllerConnected.value) return
  const port = 工位转输出口(slotIndex)
  if (port === null) return
  try {
    for (const io of 工位输出口) {
      const res = await setMotionIoOutput(io, io === port)
      if (!res.success) {
        warning(res.message || `设置输出口 ${io} 失败`)
        return
      }
    }
  } catch (e) {
    warning(e instanceof Error ? e.message : `打开工位 #${slotIndex} 输出口失败`)
  }
}

async function 点击工位(index: number): Promise<void> {
  const target = 当前目标.value
  if (!target) return
  const slot = 取工位(index)
  if (!slot) return

  选中工位.value = index
  await 打开工位输出口(index)

  if (!slot.taught) {
    设置状态(`已选中工位 #${index}（未示教，请先示教）`)
    return
  }

  const ok = 绑定当前目标到工位(index)
  if (!ok) {
    warning('绑定工位失败')
    return
  }
  设置状态(`已绑定「${target.name}」→ 工位 #${index}`)

  if (!点击工位移动.value) {
    设置状态(`已绑定「${target.name}」→ 工位 #${index}（未勾选点击移动）`)
    return
  }
  if (!controllerConnected.value) {
    设置状态(`已绑定「${target.name}」→ 工位 #${index}（控制器未连接，跳过运动）`)
    return
  }
  if (工位忙碌.value) return

  工位忙碌.value = true
  try {
    const moveRes = await moveToTenPlusSlot(slot)
    if (!moveRes.success) {
      设置状态(`已绑定；运动: ${moveRes.message || '失败'}`)
    }
  } finally {
    工位忙碌.value = false
  }
}

function 示教选中工位(): void {
  if (工位忙碌.value || !当前目标.value) return
  const index = 选中工位.value
  if (index === null) {
    warning('请先选中一个工位格')
    设置状态('请先选中一个工位格')
    return
  }
  if (!controllerConnected.value) {
    warning('请先连接控制器')
    设置状态('请先连接控制器')
    return
  }
  示教工位.value = index
  显示示教对话框.value = true
}

function 关闭示教对话框(): void {
  显示示教对话框.value = false
  示教工位.value = null
}

function 打开标定(): void {
  if (选中工位.value === null) {
    warning('请先选择工位')
    设置状态('请先选择工位')
    return
  }
  标定工位.value = 选中工位.value
  显示标定对话框.value = true
}

function 要求已选工位才转R轴(): number | null {
  const index = 选中工位.value
  if (index === null) {
    warning('请先选中一个工位格')
    设置状态('请先选中一个工位格')
    return null
  }
  if (!controllerConnected.value) {
    warning('请先连接控制器')
    设置状态('请先连接控制器')
    return null
  }
  return index
}

async function 开始选中工位R轴旋转(): Promise<void> {
  const index = 要求已选工位才转R轴()
  if (index === null || R轴忙碌.value) return
  R轴忙碌.value = true
  try {
    await 打开工位输出口(index)
    const res = await rotateRAxisCont()
    if (!res.success) {
      warning(res.message || `工位 #${index} R 轴持续旋转失败`)
      设置状态(res.message || `工位 #${index} R 轴持续旋转失败`)
      return
    }
    R轴旋转中.value = true
    success(`工位 #${index} R 轴已开始持续旋转`)
    设置状态(`工位 #${index} R 轴持续旋转中`)
  } catch (e) {
    warning(e instanceof Error ? e.message : `工位 #${index} R 轴持续旋转失败`)
  } finally {
    R轴忙碌.value = false
  }
}

async function 暂停选中工位R轴旋转(): Promise<void> {
  const index = 要求已选工位才转R轴()
  if (index === null || R轴忙碌.value) return
  R轴忙碌.value = true
  try {
    const res = await stopMotionJog('R')
    if (!res.success) {
      warning(res.message || `工位 #${index} R 轴暂停失败`)
      设置状态(res.message || `工位 #${index} R 轴暂停失败`)
      return
    }
    R轴旋转中.value = false
    success(`工位 #${index} R 轴已暂停`)
    设置状态(`工位 #${index} R 轴已暂停旋转`)
  } catch (e) {
    warning(e instanceof Error ? e.message : `工位 #${index} R 轴暂停失败`)
  } finally {
    R轴忙碌.value = false
  }
}

function 关闭标定对话框(): void {
  显示标定对话框.value = false
  标定工位.value = null
}

async function 确认示教(): Promise<void> {
  const index = 示教工位.value
  if (index === null || !当前目标.value) {
    关闭示教对话框()
    return
  }
  关闭示教对话框()

  const x = Number(mposition.value['X'])
  const y = Number(mposition.value['Y'])
  const z = Number(mposition.value['Z'])
  const u = Number(mposition.value['U'])
  if ([x, y, z, u].some((v) => Number.isNaN(v))) {
    warning('当前坐标无效，无法示教')
    return
  }

  const slot = 取工位(index)
  if (!slot) return
  slot.x = x
  slot.y = y
  slot.z = z
  slot.u = u
  slot.taught = true

  工位忙碌.value = true
  try {
    const saved = await 保存十工位配置()
    if (!saved) return
    success(`工位 #${index} 示教已保存`)
    设置状态(`工位 #${index} 示教完成`)
  } finally {
    工位忙碌.value = false
  }
}

onMounted(async () => {
  await recipeStore.loadRecipeState()
  初始化默认目标('目标 1')
  await 加载十工位配置()
  await initProgramSync()
})

onUnmounted(() => {
  cleanupProgramRunner()
})
</script>

<template>
  <div class="tpc-page">
    <!-- 工位坐标悬浮提示 -->
    <Teleport to="body">
      <div
        v-if="悬停工位 !== null"
        class="tpc-slot-tip"
        :style="{ top: `${悬停提示位置.top}px`, left: `${悬停提示位置.left}px` }"
      >
        <div class="tpc-slot-tip-title">工位 #{{ 悬停工位 }}</div>
        <template v-if="悬停工位数据?.taught">
          <div>X {{ 格式化轴(悬停工位数据.x) }}</div>
          <div>Y {{ 格式化轴(悬停工位数据.y) }}</div>
          <div>Z {{ 格式化轴(悬停工位数据.z) }}</div>
          <div>U {{ 格式化轴(悬停工位数据.u) }}</div>
        </template>
        <div v-else class="tpc-slot-tip-empty">未示教</div>
      </div>
    </Teleport>

    <!-- 等分线段 / 曲线子类型选择 -->
    <Teleport to="body">
      <div
        v-if="子类型行"
        class="tpc-curve-kind-overlay"
        @click="关闭子类型选择"
      >
        <div
          class="tpc-curve-kind-menu"
          role="menu"
          :aria-label="子类型无障碍"
          :style="{ top: `${子类型位置.top}px`, left: `${子类型位置.left}px` }"
          @click.stop
        >
          <button
            v-for="item in 子类型选项"
            :key="item.value"
            type="button"
            role="menuitemradio"
            :aria-checked="子类型当前值 === item.value"
            :class="{ on: 子类型当前值 === item.value }"
            @click="选择子类型(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 切角比例推荐值悬浮提示 -->
    <Teleport to="body">
      <div
        v-if="切角提示可见"
        class="tpc-slot-tip tpc-corner-tip"
        :style="{ top: `${切角提示位置.top}px`, left: `${切角提示位置.left}px` }"
      >
        <div class="tpc-slot-tip-title">切角比例推荐值</div>
        <div
          v-for="item in 切角比例推荐"
          :key="item.shape"
          class="tpc-corner-tip-row"
        >
          <span class="tpc-corner-tip-shape">{{ item.shape }}</span>
          <span class="tpc-corner-tip-alias">{{ item.alias }}</span>
          <span class="tpc-corner-tip-value">{{ item.value }}%</span>
          <span class="tpc-corner-tip-range">{{ item.range }}</span>
        </div>
        <div class="tpc-corner-tip-note">切角在宽度方向的投影占宽的百分比</div>
      </div>
    </Teleport>

    <!-- 示教确认 -->
    <Teleport to="body">
      <div
        v-if="显示示教对话框 && 示教工位 !== null"
        class="tpc-dlg-overlay"
        @click.self="关闭示教对话框"
      >
        <div class="tpc-dlg-card" role="dialog" aria-modal="true">
          <div class="tpc-dlg-head">示教确认</div>
          <p class="tpc-dlg-body">
            将当前机床坐标写入工位 #{{ 示教工位 }}？
          </p>
          <div class="tpc-dlg-meta">
            <span>X {{ 格式化轴(mposition['X']) }}</span>
            <span>Y {{ 格式化轴(mposition['Y']) }}</span>
            <span>Z {{ 格式化轴(mposition['Z']) }}</span>
            <span>U {{ 格式化轴(mposition['U']) }}</span>
          </div>
          <div class="tpc-dlg-btns">
            <button type="button" class="tpc-btn ghost" @click="关闭示教对话框">取消</button>
            <button type="button" class="tpc-btn primary" @click="确认示教">确认示教</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 行补偿值 -->
    <Teleport to="body">
      <TenPlusCuttingPage_CompDialog
        v-if="补偿对话框行"
        :row="补偿对话框行"
        @关闭="关闭补偿对话框"
      />
    </Teleport>

    <!-- 快捷形状编辑 -->
    <Teleport to="body">
      <TenPlusCuttingPage_ShapePresetDialog
        v-if="显示快捷形状"
        @close="关闭快捷形状"
        @confirm="确认快捷形状"
      />
    </Teleport>

    <!-- 钻石快捷形状编辑 -->
    <Teleport to="body">
      <TenPlusCuttingPage_DiamondPresetDialog
        v-if="显示钻石预设"
        @关闭="关闭钻石预设"
        @确认="确认钻石预设"
      />
    </Teleport>

    <!-- UR 补偿校准 -->
    <Teleport to="body">
      <TenPlusCuttingPage_UrCalibDialog
        v-if="显示标定对话框 && 标定工位 !== null"
        :slot-index="标定工位"
        @close="关闭标定对话框"
      />
    </Teleport>

    <!-- 开始任务：多选目标 -->
    <Teleport to="body">
      <div v-if="显示启动对话框" class="tpc-dlg-overlay" @click.self="关闭启动对话框">
        <div class="tpc-dlg-card tpc-dlg-wide" role="dialog" aria-modal="true">
          <div class="tpc-dlg-head">选择要加工的目标</div>
          <p class="tpc-dlg-body">仅可勾选已绑定工位且有点位的目标</p>
          <div class="tpc-start-list">
            <label
              v-for="(target, index) in 目标列表"
              :key="target.id"
              class="tpc-start-item"
              :class="{
                selected: 对话框已选(target.id),
                disabled: !目标可启动(target)
              }"
            >
              <input
                type="checkbox"
                :checked="对话框已选(target.id)"
                :disabled="!目标可启动(target) || 启动中"
                @change="切换对话框选择(target.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="tpc-start-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="tpc-start-text">
                <span class="tpc-start-name">{{ target.name }}</span>
                <span class="tpc-start-meta">
                  <template v-if="target.slotIndex">#{{ target.slotIndex }} · </template>
                  {{ target.rows.length }} 行
                  <template v-if="!目标可启动(target)">
                    · {{ 目标无法启动原因(target) }}
                  </template>
                </span>
              </span>
            </label>
          </div>
          <div class="tpc-dlg-btns">
            <button type="button" class="tpc-btn ghost" :disabled="启动中" @click="关闭启动对话框">
              取消
            </button>
            <button
              type="button"
              class="tpc-btn primary"
              :disabled="启动中 || !可确认启动"
              @click="确认启动对话框"
            >
              {{ 启动中 ? '启动中…' : '确认开始' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 分步操作引导 -->
    <Teleport to="body">
      <TenPlusCuttingPage_TourOverlay
        v-if="显示操作手册"
        @close="显示操作手册 = false"
      />
    </Teleport>

    <header class="tpc-top">
      <div class="tpc-top-left">
        <RouterLink to="/home" class="tpc-home-link">返回首页</RouterLink>
        <div>
          <h1 class="tpc-title">十轴切割</h1>
          <p class="tpc-sub">十轴自由参数编辑切割程序</p>
        </div>
      </div>
      <div class="tpc-top-right">
        <button type="button" class="tpc-guide-text-btn" @click="打开操作手册">
          <span class="tpc-guide-mark" aria-hidden="true">?</span>
          <span>十轴切割操作指南</span>
        </button>
        <div class="tpc-top-group tpc-top-group-aux" aria-label="页面辅助">
          <button
            type="button"
            class="tpc-kb-toggle"
            role="switch"
            :aria-checked="keyboardEnabled ? 'true' : 'false'"
            title="关闭时方向键不会点动轴，方便填表"
            @click="keyboardEnabled = !keyboardEnabled"
          >
            <span class="tpc-kb-label">键盘操作</span>
            <span class="tpc-kb-switch" :class="{ on: keyboardEnabled }" aria-hidden="true">
              <span class="tpc-kb-knob" />
            </span>
            <span class="tpc-kb-state">{{ keyboardEnabled ? '开' : '关' }}</span>
          </button>
          <button
            type="button"
            class="tpc-kb-toggle"
            role="switch"
            :aria-checked="runCameraEnlarge ? 'true' : 'false'"
            title="开启后，任务运行时相机会放大并替代中间任务参数表，结束后恢复"
            @click="runCameraEnlarge = !runCameraEnlarge"
          >
            <span class="tpc-kb-label">运行时放大</span>
            <span class="tpc-kb-switch" :class="{ on: runCameraEnlarge }" aria-hidden="true">
              <span class="tpc-kb-knob" />
            </span>
            <span class="tpc-kb-state">{{ runCameraEnlarge ? '开' : '关' }}</span>
          </button>
          <button
            type="button"
            class="tpc-aux-btn"
            :class="{ on: cameraVisible }"
            :disabled="显示标定对话框"
            :title="显示标定对话框 ? 'UR 校准打开时相机窗口已关闭' : undefined"
            @click="cameraVisible = !cameraVisible"
          >
            {{ cameraVisible ? '隐藏相机画面' : '显示相机画面' }}
          </button>
        </div>
        <div class="tpc-top-group tpc-top-group-mode" role="tablist" aria-label="工作模式">
          <button
            type="button"
            class="tpc-mode-btn"
            :class="{ active: 工作模式 === '自由参数' }"
            @click="工作模式 = '自由参数'"
          >
            自由参数编程
          </button>
          <button
            type="button"
            class="tpc-mode-btn"
            :class="{ active: 工作模式 === '画图' }"
            @click="工作模式 = '画图'"
          >
            普通绘制图像
          </button>
        </div>
      </div>
    </header>

    <div v-if="工作模式 === '自由参数'" class="tpc-body">
      <!-- 左：目标列表 -->
      <aside class="tpc-targets">
        <div class="tpc-panel-head">
          <span>编程目标</span>
          <button type="button" class="tpc-btn-sm" data-tour="add-target" @click="添加目标">
            + 新建
          </button>
        </div>
        <div class="tpc-targets-list">
          <div
            v-for="(target, index) in 目标列表"
            :key="target.id"
            class="tpc-target-item"
            :class="{ active: target.id === 当前目标编号 }"
            @click="选择目标(target.id)"
          >
            <template v-if="重命名中的编号 === target.id">
              <input
                ref="重命名输入"
                v-model="重命名草稿"
                class="tpc-rename"
                @click.stop
                @keydown.enter.prevent="提交重命名"
                @keydown.esc.prevent="取消重命名"
                @blur="提交重命名"
              />
            </template>
            <template v-else>
              <button
                type="button"
                class="tpc-target-main"
                @dblclick.stop="开始重命名(target.id, target.name)"
              >
                <span class="tpc-target-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="tpc-target-text">
                  <span class="tpc-target-name">{{ target.name }}</span>
                  <span class="tpc-target-meta">
                    {{ target.rows.length }} 行
                    <template v-if="target.slotIndex"> · #{{ target.slotIndex }}</template>
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="tpc-target-del"
                :disabled="目标列表.length <= 1"
                title="删除目标"
                @click.stop="删除目标(target.id)"
              >
                ✕
              </button>
            </template>
          </div>
        </div>
      </aside>

      <!-- 中：任务表；运行放大时由相机占位 -->
      <section class="tpc-workspace">
        <div v-show="!相机停靠工作区" class="tpc-workspace-stack">
        <div class="tpc-workspace-head">
          <div>
            <span class="tpc-kicker">任务参数表</span>
            <span class="tpc-active-name">{{ 当前目标?.name ?? '—' }}</span>
            <span class="tpc-hint">双击目标名可重命名</span>
          </div>
          <button
            type="button"
            class="tpc-btn-sm add"
            data-tour="add-row"
            :disabled="!当前目标"
            @click="添加任务行"
          >
            + 添加任务
          </button>
        </div>
        <div class="tpc-table-wrap">
          <table class="tpc-table">
            <thead>
              <tr>
                <th class="col-path">
                  <span class="tpc-th-with-help">
                    类型
                    <button
                      type="button"
                      class="tpc-shape-preset-btn"
                      data-tour="diamond-preset"
                      :disabled="!当前目标"
                      title="按腰宽与冠/腰/亭高比生成台面+三层（圆钻等分线段，祖母绿/雷迪恩切角矩形）"
                      @click="打开钻石预设"
                    >
                      钻石快捷形状编辑
                    </button>
                  </span>
                </th>
                <th class="col-no">序号</th>
                <th class="col-same" title="勾选后与上一行同一高度平面，不叠层">同层</th>
                <th class="col-size">
                  <span class="tpc-th-with-help">
                    尺寸 (mm)
                    <button
                      type="button"
                      class="tpc-shape-preset-btn"
                      data-tour="shape-preset"
                      :disabled="!当前目标"
                      title="按外接尺寸生成垫型等快捷形状到当前目标"
                      @click="打开快捷形状"
                    >
                      快捷形状编辑
                    </button>
                  </span>
                </th>
                <th class="col-num">角度 (°)</th>
                <th class="col-num">高度 (mm)</th>
                <th class="col-num">
                  <span class="tpc-th-with-help">
                    {{ 分割列表头 }}
                    <button
                      v-if="显示切角说明"
                      type="button"
                      class="tpc-corner-help"
                      aria-label="查看切角比例推荐值2"
                      @mouseenter="切角提示进入"
                      @mouseleave="切角提示离开"
                      @focus="切角提示进入"
                      @blur="切角提示离开"
                    >
                      ?
                    </button>
                  </span>
                </th>
                <th class="col-recipe">配方</th>
                <th class="col-comp">补偿</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in 任务行列表" :key="row.id">
                <td class="col-path">
                  <div class="tpc-path-seg" role="radiogroup" aria-label="类型">
                    <button
                      v-for="item in 路径类型按钮"
                      :key="item.value"
                      type="button"
                      role="radio"
                      :aria-checked="路径按钮点亮(row, item.value)"
                      :class="{ on: 路径按钮点亮(row, item.value) }"
                      :aria-label="
                        路径类型标题(
                          item.value,
                          item.label,
                          row.curveKind,
                          row.superellipseN,
                          row.pathType
                        )
                      "
                      :title="
                        item.value === 曲线路径类型 || item.value === 等分线段类型
                          ? `${路径类型标题(item.value, item.label, row.curveKind, row.superellipseN, row.pathType)}（双击选择子类型）`
                          : item.label
                      "
                      @click="路径类型变化(row, item.value)"
                      @dblclick.stop="路径类型双击(row, item.value, $event)"
                    >
                      {{
                        路径按钮点亮(row, item.value)
                          ? 路径类型标题(
                              item.value,
                              item.label,
                              row.curveKind,
                              row.superellipseN,
                              row.pathType
                            )
                          : item.label
                      }}
                    </button>
                  </div>
                </td>
                <td class="col-no">
                  <span class="tpc-task-no">{{ row.taskNo }}</span>
                </td>
                <td class="col-same">
                  <input
                    v-model="row.sameLayer"
                    type="checkbox"
                    class="tpc-same-layer"
                    :disabled="rowIndex === 0 || !是曲线(row.pathType) || 是台面角(row.angle)"
                    :title="
                      rowIndex === 0
                        ? '首行没有上一行可同层'
                        : !是曲线(row.pathType)
                          ? '同层仅用于曲线段编组'
                          : 是台面角(row.angle)
                            ? '台面行不能同层'
                            : '与上一行同一高度平面，不把上一行高度叠上去'
                    "
                  />
                </td>
                <td class="col-size">
                  <div v-if="是非等分直线(row.pathType)" class="tpc-size-pair">
                    <label>
                      <span>长</span>
                      <input
                        v-model.number="row.length"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 直径无效(row.length) }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="直径无效(row.length) ? '长必须在 0~200 之间' : ''"
                      />
                    </label>
                    <label>
                      <span>宽</span>
                      <input
                        v-model.number="row.width"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 直径无效(row.width) }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="直径无效(row.width) ? '宽必须在 0~200 之间' : ''"
                      />
                    </label>
                  </div>
                  <div
                    v-else-if="是超椭圆曲线(row.pathType, row.curveKind, row.superellipseN)"
                    class="tpc-size-pair tpc-size-curve"
                  >
                    <label>
                      <span>长</span>
                      <input
                        v-model.number="row.length"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 直径无效(row.length) || Number(row.length) <= 0 }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="'超椭圆外接长 (mm)'"
                      />
                    </label>
                    <label>
                      <span>宽</span>
                      <input
                        v-model.number="row.width"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 直径无效(row.width) || Number(row.width) <= 0 }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="'超椭圆外接宽 (mm)'"
                      />
                    </label>
                    <label>
                      <span>n</span>
                      <input
                        v-model.number="row.superellipseN"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 超椭圆指数无效(row.superellipseN) }"
                        step="0.1"
                        min="1.5"
                        max="12"
                        :title="'超椭圆指数 n，2≈椭圆，4=垫型'"
                      />
                    </label>
                  </div>
                  <div v-else-if="是曲线(row.pathType)" class="tpc-size-pair tpc-size-curve">
                    <label>
                      <span>半径</span>
                      <input
                        v-model.number="row.diameter"
                        type="number"
                        class="tpc-input"
                        :class="{
                          invalid:
                            直径无效(row.diameter) ||
                            台面直径为零(row.diameter, row.angle)
                        }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="
                          台面直径为零(row.diameter, row.angle)
                            ? '台面行半径不能为 0'
                            : 直径无效(row.diameter)
                              ? '半径必须在 0~200 之间'
                              : '这一段弧自己的半径'
                        "
                      />
                    </label>
                    <label>
                      <span>偏X</span>
                      <input
                        v-model.number="row.arcOffsetX"
                        type="number"
                        class="tpc-input"
                        step="0.01"
                        :title="'圆心相对工位中心的 X 偏移'"
                      />
                    </label>
                    <label>
                      <span>偏Y</span>
                      <input
                        v-model.number="row.arcOffsetY"
                        type="number"
                        class="tpc-input"
                        step="0.01"
                        :title="'圆心相对工位中心的 Y 偏移'"
                      />
                    </label>
                  </div>
                  <div v-else class="tpc-size-pair tpc-size-single">
                    <label>
                      <span>外接圆直径</span>
                      <input
                        v-model.number="row.diameter"
                        type="number"
                        class="tpc-input"
                        :class="{
                          invalid:
                            直径无效(row.diameter) ||
                            台面直径为零(row.diameter, row.angle)
                        }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="
                          台面直径为零(row.diameter, row.angle)
                            ? '台面行直径不能为 0'
                            : 直径无效(row.diameter)
                              ? '外接圆直径必须在 0~200 之间'
                              : ''
                        "
                      />
                    </label>
                  </div>
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.angle"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: 角度无效(row.angle) }"
                    step="0.1"
                    min="-90"
                    max="90"
                    :title="角度无效(row.angle) ? '角度必须在 -90~90 之间' : ''"
                    @input="行角度变化(row, $event)"
                  />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.height"
                    type="number"
                    class="tpc-input"
                    :class="{
                      invalid:
                        高度无效(row.height) || 非台面高度为零(row.height, row.angle)
                    }"
                    min="0"
                    max="20"
                    step="0.001"
                    :disabled="是台面角(row.angle)"
                    :title="
                      是台面角(row.angle)
                        ? '台面行（角度为 0）高度固定为 0'
                        : 非台面高度为零(row.height, row.angle)
                          ? '非台面行高度不能为 0'
                          : 高度无效(row.height)
                            ? '高度必须在 0~20 之间'
                            : ''
                    "
                  />
                </td>
                <td class="col-num">
                  <div v-if="是曲线(row.pathType)" class="tpc-size-pair">
                    <label>
                      <span>起</span>
                      <input
                        v-model.number="row.arcStart"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 弧角无效(row.arcStart, row.arcEnd) }"
                        step="1"
                        :title="'圆弧起始角 (°)，+X 为 0，逆时针为正'"
                      />
                    </label>
                    <label>
                      <span>终</span>
                      <input
                        v-model.number="row.arcEnd"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: 弧角无效(row.arcStart, row.arcEnd) }"
                        step="1"
                        :title="'圆弧结束角 (°)'"
                      />
                    </label>
                  </div>
                  <input
                    v-else-if="是非等分直线(row.pathType)"
                    v-model.number="row.cornerRatio"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: 切角比例无效(row.cornerRatio, row.length, row.width) }"
                    step="0.1"
                    min="0"
                    max="50"
                    :title="
                      切角比例无效(row.cornerRatio, row.length, row.width)
                        ? '切角比例须在 0~50% 之间，且切角量不得超过长的一半'
                        : '切角在宽度方向的投影占宽的百分比；轮廓固定 8 条边，无需分割数'
                    "
                  />
                  <input
                    v-else
                    v-model.number="row.divisions"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: 分割数无效(row.divisions) }"
                    :disabled="是台面角(row.angle)"
                    :title="
                      是台面角(row.angle)
                        ? '台面行（角度为 0）分割数固定为默认值'
                        : 分割数无效(row.divisions)
                          ? '分割数须为 0 或 3~360'
                          : ''
                    "
                  />
                </td>
                <td class="col-recipe">
                  <select
                    v-model="row.recipe"
                    class="tpc-select"
                    :class="{ invalid: 配方无效(row.recipe) }"
                    :title="配方无效(row.recipe) ? '请选择配方' : ''"
                  >
                    <option value="">—</option>
                    <option v-for="r in 启用主配方" :key="r.id" :value="r.id">
                      {{ 配方标签(r) }}
                    </option>
                  </select>
                </td>
                <td class="col-comp">
                  <button
                    type="button"
                    class="tpc-btn-sm"
                    title="修改角度补偿、XYZ 补偿、K/B/X"
                    @click="打开补偿对话框(row)"
                  >
                    修改补偿值
                  </button>
                </td>
                <td class="col-act">
                  <button
                    type="button"
                    class="tpc-row-del"
                    :disabled="任务行列表.length <= 1"
                    title="删除行"
                    @click="删除任务行(row.id)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
        <div
          v-show="相机停靠工作区"
          id="tpc-workspace-cam-host"
          class="tpc-workspace-cam-host"
        />
      </section>

      <!-- 右：目标参数 + 十工位 -->
      <aside class="tpc-params">
        <div class="tpc-panel-head"><span>目标参数</span></div>
        <div v-if="当前目标" class="tpc-params-body">
          <div class="tpc-card">
            <div class="tpc-card-title">圈补偿</div>
            <label class="tpc-field">
              <span>每旋转（圈）</span>
              <input
                v-model.number="当前目标.十轴切割R旋转圈数"
                type="number"
                class="tpc-input"
                step="1"
                min="0"
              />
            </label>
            <label class="tpc-field">
              <span>补偿量 (mm)</span>
              <input
                v-model.number="当前目标.十轴切割R旋转补偿值"
                type="number"
                class="tpc-input"
                step="0.001"
              />
            </label>
          </div>

          <div class="tpc-card">
            <div class="tpc-xyz-block" data-tour="point-xyz">
              <div class="tpc-card-head">
                <div class="tpc-card-title">设置水平点位 XYZ</div>
                <button type="button" class="tpc-btn-sm" title="获取当前机床 XYZ" @click="获取点位">
                  获取
                </button>
              </div>
              <div class="tpc-xyz-grid">
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-x">X</span>
                  <span class="tpc-xyz-val" :class="{ empty: 当前点位轴.x === '—' }">{{
                    当前点位轴.x
                  }}</span>
                </div>
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-y">Y</span>
                  <span class="tpc-xyz-val" :class="{ empty: 当前点位轴.y === '—' }">{{
                    当前点位轴.y
                  }}</span>
                </div>
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-z">Z</span>
                  <span class="tpc-xyz-val" :class="{ empty: 当前点位轴.z === '—' }">{{
                    当前点位轴.z
                  }}</span>
                </div>
              </div>
            </div>
            <label class="tpc-switch-row" data-tour="opposite-cut" title="是否对该目标做对切" >
              <span>是否对切</span>
              <input v-model="当前目标.oppositeCut" type="checkbox" class="tpc-switch" />
            </label>
            <!-- <label class="tpc-switch-row" data-tour="直接采用相机取点" title="直接采用相机取点" >
              <span>根据相机采点</span>
              <input v-model="当前目标.oppositeCut" type="checkbox" class="tpc-switch" />
            </label> -->
            

            <div class="tpc-slot-block">
              <div class="tpc-slot-head">
                <span>工位选择</span>
                <div class="tpc-slot-head-actions">
                  <label
                    class="tpc-slot-move"
                    data-tour="move-on-click"
                    title="勾选后，点击已示教工位会运动到该点"
                  >
                    <input v-model="点击工位移动" type="checkbox" />
                    <span>点击移动</span>
                  </label>
                  <button
                    type="button"
                    class="tpc-btn-sm"
                    data-tour="teach"
                    :disabled="工位忙碌 || 选中工位 === null"
                    @click="示教选中工位"
                  >
                    示教选中格
                  </button>
                </div>
              </div>
              <p v-if="当前目标.slotIndex" class="tpc-slot-hint">
                当前绑定工位 #{{ 当前目标.slotIndex }}
              </p>
              <div class="tpc-slot-grid" data-tour="slots">
                <button
                  v-for="n in 网格顺序"
                  :key="n"
                  type="button"
                  class="tpc-slot-cell"
                  :class="工位格样式(n)"
                  @click="点击工位(n)"
                  @mouseenter="工位悬停进入($event, n)"
                  @mouseleave="工位悬停离开"
                >
                  <span class="tpc-slot-no">{{ n }}</span>
                  <span class="tpc-slot-name">{{ 绑定目标名(n) || '—' }}</span>
                </button>
              </div>
              <div
                class="tpc-r-card"
                data-tour="r-spin"
                :class="{ ready: 选中工位 !== null, spinning: R轴旋转中 }"
              >
                <span class="tpc-r-badge" aria-hidden="true">R</span>
                <span class="tpc-r-copy">
                  <span class="tpc-r-title">R 轴旋转</span>
                  <span class="tpc-r-meta">
                    <template v-if="选中工位">
                      工位 #{{ 选中工位 }}
                      <template v-if="R轴旋转中"> · 旋转中</template>
                      <template v-else-if="!controllerConnected"> · 未连接</template>
                    </template>
                    <template v-else>请先点选上方工位</template>
                  </span>
                </span>
                <span class="tpc-r-ops">
                  <button
                    type="button"
                    class="tpc-r-op start"
                    :disabled="工位忙碌 || R轴忙碌 || 选中工位 === null || !controllerConnected"
                    title="选中工位 R 轴持续旋转"
                    @click="开始选中工位R轴旋转"
                  >
                    持续旋转
                  </button>
                  <button
                    type="button"
                    class="tpc-r-op pause"
                    :disabled="工位忙碌 || R轴忙碌 || 选中工位 === null || !controllerConnected"
                    title="选中工位 R 轴暂停旋转"
                    @click="暂停选中工位R轴旋转"
                  >
                    暂停
                  </button>
                </span>
              </div>
              <button
                type="button"
                class="tpc-ur-entry"
                data-tour="ur-calib"
                :class="{ ready: 选中工位 !== null }"
                @click="打开标定"
              >
                <span class="tpc-ur-axes" aria-hidden="true">
                  <span class="tpc-ur-axis u">U</span>
                  <span class="tpc-ur-axis r">R</span>
                </span>
                <span class="tpc-ur-copy">
                  <span class="tpc-ur-title">UR 补偿校准</span>
                  <span class="tpc-ur-meta">
                    <template v-if="选中工位">工位 #{{ 选中工位 }} · 相机对中</template>
                    <template v-else>请先点选上方工位</template>
                  </span>
                </span>
                <span class="tpc-ur-go">打开</span>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="tpc-params-empty">请选择一个编程目标</div>
      </aside>
    </div>

    <div v-else class="tpc-draw-empty">
      <p class="tpc-draw-title">普通绘制图像</p>
      <p class="tpc-draw-desc">功能占位，后续接入绘制流程</p>
    </div>

    <Teleport :to="相机停靠工作区 ? '#tpc-workspace-cam-host' : 'body'">
      <TenPlusCuttingPage_CameraWindow
        v-if="显示相机窗口"
        :docked="相机停靠工作区"
      />
    </Teleport>

    <footer class="tpc-footer">
      <label class="tpc-confirm" data-tour="confirm">
        <input v-model="流程已确认" type="checkbox" :disabled="启动中" />
        <span>已确认可正常加工</span>
      </label>
      <button
        type="button"
        class="tpc-confirm-help"
        aria-label="分步操作引导"
        title="分步操作引导"
        @click="打开操作手册"
      >
        ?
      </button>
      <button
        type="button"
        class="tpc-btn start"
        data-tour="start"
        :disabled="启动中 || !流程已确认"
        @click="开始运行"
      >
        {{ 启动中 ? '启动中…' : '开始任务' }}
      </button>
      <TenPlusCuttingPage_RunControls
        :program-running="programRunning"
        :program-paused="programPaused"
        :program-task-count="programTaskCount"
        :jindubaifenbi="currentTaskJindubaifenbi"
        :elapsed-text="programElapsedText"
        @pause-toggle="onPauseToggleClick"
        @reset-alarms="onResetAlarmsClick"
        @estop="onEstopClick"
        @skip-task="onSkipTaskClick"
      />
      <span v-if="状态文案" class="tpc-status" :title="状态文案">{{ 状态文案 }}</span>
      <input
        ref="文件输入"
        type="file"
        accept=".jjs,application/json"
        class="tpc-file"
        @change="文件变化"
      />
      <span data-tour="files" class="tpc-file-ops">
        <button type="button" class="tpc-btn ghost" @click="点击加载">读取</button>
        <button type="button" class="tpc-btn ghost" @click="保存任务">保存</button>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.tpc-page,
.tpc-dlg-overlay,
.tpc-slot-tip {
  --tpc-accent: #007aff;
  --tpc-apple-blue: #007aff;
  --tpc-apple-green: #34c759;
  --tpc-apple-orange: #ff9f0a;
  --tpc-apple-red: #ff3b30;
  --tpc-apple-fill: color-mix(in srgb, var(--app-text-primary) 5.5%, transparent);
}
.tpc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--app-bg);
  color: var(--app-text-primary);
  overflow: hidden;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro Text',
    'Segoe UI Variable Display',
    'Segoe UI',
    system-ui,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  accent-color: var(--tpc-apple-blue);
}

.tpc-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 16px;
  padding: 10px 16px;
  border-bottom: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  flex-shrink: 0;
  background: color-mix(in srgb, var(--app-card) 72%, transparent);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
}
.tpc-title {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
}
.tpc-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
}
.tpc-top-left {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: start;
  min-width: 0;
}
.tpc-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
  flex-wrap: wrap;
}
.tpc-top-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--tpc-apple-fill);
  border: 0;
}
.tpc-top-group-aux {
  gap: 6px;
  padding: 3px 8px 3px 10px;
}
.tpc-top-group-mode {
  gap: 2px;
}
.tpc-aux-btn {
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 590;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}
.tpc-aux-btn.on {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--app-card) 88%, transparent);
  box-shadow: 0 0.5px 1.5px color-mix(in srgb, #000 12%, transparent);
}
.tpc-aux-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tpc-kb-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  color: var(--app-text-secondary);
  cursor: pointer;
  user-select: none;
}
.tpc-kb-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tpc-apple-blue) 70%, transparent);
  outline-offset: 3px;
  border-radius: 8px;
}
.tpc-kb-label {
  letter-spacing: 0.01em;
}
.tpc-kb-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-text-muted) 22%, var(--app-card));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-text-primary) 8%, transparent);
  transition: background 0.18s ease;
}
.tpc-kb-switch.on {
  background: var(--tpc-apple-green);
  box-shadow: none;
}
.tpc-kb-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px color-mix(in srgb, #000 22%, transparent);
  transition: transform 0.18s ease;
}
.tpc-kb-switch.on .tpc-kb-knob {
  transform: translateX(16px);
}
.tpc-kb-state {
  min-width: 1.25em;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-muted);
}
.tpc-kb-toggle[aria-checked='true'] .tpc-kb-state {
  color: var(--tpc-apple-green);
}
.tpc-home-link {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 590;
  color: var(--tpc-apple-blue);
  background: var(--tpc-apple-fill);
  border: 0;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.tpc-home-link:hover {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-mode-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 590;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}
.tpc-mode-btn.active {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 92%, transparent);
  box-shadow: 0 0.5px 1.5px color-mix(in srgb, #000 14%, transparent);
}

.tpc-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 10px;
  padding: 10px 12px;
}

.tpc-targets,
.tpc-workspace,
.tpc-params {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  overflow: hidden;
}

.tpc-workspace-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tpc-workspace-cam-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tpc-panel-head,
.tpc-workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
  color: var(--app-text-secondary);
  flex-shrink: 0;
  background: var(--app-card-soft);
}
.tpc-kicker {
  font-weight: 600;
  color: var(--app-text-primary);
  margin-right: 8px;
}
.tpc-active-name {
  color: color-mix(in srgb, var(--tpc-accent) 72%, var(--app-text-primary));
  margin-right: 8px;
}
.tpc-hint {
  font-size: 11px;
  color: var(--app-text-muted);
}

.tpc-targets-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tpc-target-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  padding: 4px;
  cursor: pointer;
}
.tpc-target-item.active {
  border-color: var(--tpc-accent);
  background: color-mix(in srgb, var(--tpc-accent) 12%, var(--app-card));
}
.tpc-target-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  padding: 4px;
}
.tpc-target-index {
  font-size: 11px;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}
.tpc-target-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-target-name {
  font-size: 13px;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpc-target-meta {
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-target-del,
.tpc-row-del {
  background: none;
  border: none;
  color: var(--app-text-muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.tpc-target-del:hover:not(:disabled),
.tpc-row-del:hover:not(:disabled) {
  color: #dc2626;
  background: color-mix(in srgb, #dc2626 10%, var(--app-card));
}
.tpc-target-del:disabled,
.tpc-row-del:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tpc-rename {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--app-text-primary);
  background: var(--app-input-bg);
  border: 1px solid var(--tpc-accent);
  border-radius: 6px;
  outline: none;
}

.tpc-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.tpc-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12px;
}
.tpc-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--app-card-soft);
  color: var(--app-text-muted);
  font-weight: 500;
  padding: 6px 4px;
  border-bottom: 1px solid var(--app-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpc-table td {
  padding: 4px;
  border-bottom: 1px solid var(--app-border);
  overflow: hidden;
  vertical-align: middle;
}
.tpc-table th,
.tpc-table td {
  width: auto;
}
.tpc-table .col-path {
  width: 24%;
  min-width: 220px;
}
.tpc-table .col-no {
  width: 36px;
  padding-left: 2px;
  padding-right: 2px;
  text-align: center;
}
.tpc-table .col-same {
  width: 32px;
  padding-left: 0;
  padding-right: 2px;
  text-align: center;
}
.tpc-table .col-size {
  width: 18%;
  min-width: 220px;
}
.tpc-table .col-num {
  width: 7%;
}
.tpc-table .col-recipe {
  width: 10%;
}
.tpc-table .col-comp {
  width: 88px;
}
.tpc-table .col-act {
  width: 28px;
  padding-left: 2px;
  padding-right: 2px;
}
.tpc-same-layer {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--tpc-accent);
  cursor: pointer;
}
.tpc-same-layer:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.tpc-size-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  min-width: 0;
}
.tpc-size-curve {
  grid-template-columns: 1.2fr 0.9fr 0.9fr;
}
.tpc-size-pair label {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.tpc-size-pair span {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--app-text-muted);
}
.tpc-size-single {
  grid-template-columns: 1fr;
}
.tpc-th-with-help {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tpc-shape-preset-btn {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 6px;
  border: 0;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  letter-spacing: 0;
  color: var(--tpc-accent);
  background: color-mix(in srgb, var(--tpc-accent) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tpc-accent) 28%, transparent);
  cursor: pointer;
  white-space: nowrap;
}
.tpc-shape-preset-btn:hover:not(:disabled) {
  color: #fff;
  background: var(--tpc-accent);
  box-shadow: none;
}
.tpc-shape-preset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-corner-help {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  font-size: 10px;
  font-weight: 650;
  font-family: inherit;
  line-height: 1;
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-text-primary) 7%, transparent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 9%, transparent);
  transition:
    color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.tpc-corner-help:hover,
.tpc-corner-help:focus-visible {
  color: #fff;
  background: var(--tpc-accent);
  box-shadow:
    inset 0 0.5px 0 color-mix(in srgb, #fff 45%, transparent),
    0 2px 6px color-mix(in srgb, var(--tpc-accent) 42%, transparent);
  outline: none;
  transform: translateY(-0.5px);
}
.tpc-corner-help:active {
  transform: scale(0.9);
}
.tpc-task-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--app-text-secondary);
  background: color-mix(in srgb, var(--app-text-primary) 7%, var(--app-card));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-text-primary) 10%, var(--app-border));
}
.col-comp .tpc-btn-sm {
  width: 100%;
  padding-left: 4px;
  padding-right: 4px;
}
.muted { color: var(--app-text-muted); }

.tpc-path-seg {
  display: flex;
  gap: 0;
  min-width: 0;
  padding: 3px;
  background: color-mix(in srgb, var(--app-text-primary) 8%, var(--app-card-soft));
  border: 0;
  border-radius: 8px;
}
.tpc-path-seg button {
  flex: 1;
  min-width: 0;
  padding: 4px 3px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  font-family: inherit;
  color: var(--app-text-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    font-weight 0.16s ease;
}
.tpc-path-seg button:hover:not(.on) {
  color: var(--app-text-secondary);
}
.tpc-path-seg button.on {
  color: var(--app-text-primary);
  font-weight: 650;
  background: var(--app-card);
  box-shadow:
    0 0.5px 0 color-mix(in srgb, #fff 55%, transparent) inset,
    0 1px 2px color-mix(in srgb, var(--app-text-primary) 12%, transparent);
}

.tpc-curve-kind-overlay {
  position: fixed;
  inset: 0;
  z-index: 10060;
}
.tpc-curve-kind-menu {
  position: fixed;
  display: flex;
  flex-direction: column;
  min-width: 128px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
}
.tpc-curve-kind-menu button {
  padding: 7px 10px;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  color: var(--app-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.tpc-curve-kind-menu button:hover {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-text-primary) 8%, transparent);
}
.tpc-curve-kind-menu button.on {
  color: var(--app-text-primary);
  font-weight: 650;
  background: color-mix(in srgb, var(--app-text-primary) 10%, transparent);
}

.tpc-input,
.tpc-select {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--app-text-primary);
  background: var(--app-input-bg);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  outline: none;
}
.tpc-input[type="number"] {
  text-align: center;
}
.tpc-select {
  appearance: none;
  padding-right: 18px;
  color-scheme: inherit;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%2364748b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='m1 1 4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 10px 6px;
  cursor: pointer;
}
.tpc-input:focus,
.tpc-select:focus {
  border-color: var(--tpc-accent);
}
.tpc-input.invalid,
.tpc-select.invalid {
  border-color: #ef4444;
  background: color-mix(in srgb, #ef4444 12%, var(--app-input-bg));
}
.tpc-input::-webkit-outer-spin-button,
.tpc-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.tpc-input {
  appearance: textfield;
  -moz-appearance: textfield;
}
.tpc-input:disabled,
.tpc-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  color: var(--app-text-muted);
}

.tpc-params-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tpc-params-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--app-text-muted);
  font-size: 12px;
}
.tpc-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpc-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-primary);
}
.tpc-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tpc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-xyz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.tpc-xyz-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 7px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
}
.tpc-xyz-axis {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}
.tpc-xyz-axis.axis-x {
  color: #d97706;
}
.tpc-xyz-axis.axis-y {
  color: #16a34a;
}
.tpc-xyz-axis.axis-z {
  color: #2563eb;
}
.tpc-xyz-val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.tpc-xyz-val.empty {
  color: var(--app-text-muted);
}
.tpc-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.tpc-switch-row .tpc-switch {
  appearance: none;
  width: 32px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--app-border);
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
}
.tpc-switch-row .tpc-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--app-card);
  box-shadow: 0 0 0 1px var(--app-border);
  transition: transform 0.15s;
}
.tpc-switch-row .tpc-switch:checked {
  background: #16a34a;
}
.tpc-switch-row .tpc-switch:checked::after {
  transform: translateX(14px);
  box-shadow: none;
  background: #fff;
}
.tpc-slot-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.tpc-slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
}
.tpc-slot-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.tpc-slot-move {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  color: var(--app-text-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.tpc-slot-move input {
  margin: 0;
  accent-color: #16a34a;
}
.tpc-slot-hint {
  margin: 0;
  font-size: 11px;
  color: #d97706;
}
.tpc-slot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.tpc-r-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card);
}
.tpc-r-card.ready {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--app-border));
  background: color-mix(in srgb, #f59e0b 8%, var(--app-card));
}
.tpc-r-card.spinning {
  border-color: color-mix(in srgb, #16a34a 50%, var(--app-border));
  background: color-mix(in srgb, #16a34a 8%, var(--app-card));
}
.tpc-r-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, #f59e0b 60%, var(--app-text-primary));
  background: color-mix(in srgb, #f59e0b 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-r-card.spinning .tpc-r-badge {
  color: #fff;
  background: #16a34a;
  border-color: #16a34a;
}
.tpc-r-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.tpc-r-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
  line-height: 1.2;
}
.tpc-r-meta {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tpc-r-card.ready .tpc-r-meta {
  color: color-mix(in srgb, #f59e0b 55%, var(--app-text-primary));
}
.tpc-r-card.spinning .tpc-r-meta {
  color: color-mix(in srgb, #16a34a 55%, var(--app-text-primary));
}
.tpc-r-ops {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.tpc-r-op {
  min-width: 72px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  border: 1px solid var(--app-border);
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.tpc-r-op.start {
  color: color-mix(in srgb, #16a34a 55%, var(--app-text-primary));
  background: color-mix(in srgb, #16a34a 12%, var(--app-card));
  border-color: color-mix(in srgb, #16a34a 28%, var(--app-border));
}
.tpc-r-op.start:hover:not(:disabled) {
  color: #fff;
  background: #16a34a;
  border-color: #16a34a;
}
.tpc-r-op.pause {
  color: color-mix(in srgb, #d97706 55%, var(--app-text-primary));
  background: color-mix(in srgb, #d97706 12%, var(--app-card));
  border-color: color-mix(in srgb, #d97706 28%, var(--app-border));
}
.tpc-r-op.pause:hover:not(:disabled) {
  color: #fff;
  background: #d97706;
  border-color: #d97706;
}
.tpc-r-op:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-ur-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card);
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.12s;
}
.tpc-ur-entry:hover {
  border-color: color-mix(in srgb, #0ea5e9 55%, var(--app-border));
  background: color-mix(in srgb, #0ea5e9 8%, var(--app-card));
  transform: translateY(-1px);
}
.tpc-ur-entry:active {
  transform: translateY(0);
}
.tpc-ur-entry.ready {
  border-color: color-mix(in srgb, #0ea5e9 50%, var(--app-border));
  background: color-mix(in srgb, #0ea5e9 10%, var(--app-card));
}
.tpc-ur-entry.ready:hover {
  border-color: #0ea5e9;
}
.tpc-ur-axes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  flex-shrink: 0;
  width: 40px;
}
.tpc-ur-axis {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.tpc-ur-axis.u {
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
  background: color-mix(in srgb, #0ea5e9 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #0ea5e9 40%, var(--app-border));
}
.tpc-ur-axis.r {
  color: color-mix(in srgb, #f59e0b 55%, var(--app-text-primary));
  background: color-mix(in srgb, #f59e0b 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-ur-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.tpc-ur-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
  line-height: 1.2;
}
.tpc-ur-meta {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tpc-ur-entry.ready .tpc-ur-meta {
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
}
.tpc-ur-go {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
  background: color-mix(in srgb, #0ea5e9 12%, var(--app-card));
  border: 1px solid color-mix(in srgb, #0ea5e9 28%, var(--app-border));
}
.tpc-ur-entry.ready .tpc-ur-go {
  color: #fff;
  background: #0ea5e9;
  border-color: #0ea5e9;
}
.tpc-slot-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  padding: 6px 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-input-bg);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.tpc-slot-cell.slot-empty {
  opacity: 0.72;
}
.tpc-slot-cell.slot-taught {
  border-color: color-mix(in srgb, #16a34a 45%, var(--app-border));
  background: color-mix(in srgb, #16a34a 10%, var(--app-card));
}
.tpc-slot-cell.slot-selected {
  border-color: color-mix(in srgb, var(--tpc-accent) 55%, var(--app-border));
  background: color-mix(in srgb, var(--tpc-accent) 12%, var(--app-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tpc-accent) 18%, transparent);
}
.tpc-slot-cell.slot-bound {
  border-color: #d97706;
  background: color-mix(in srgb, #d97706 12%, var(--app-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, #d97706 22%, transparent);
  color: color-mix(in srgb, #d97706 50%, var(--app-text-primary));
}
.tpc-slot-cell:hover {
  border-color: color-mix(in srgb, var(--tpc-accent) 40%, var(--app-border));
}
.tpc-slot-no {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
}
.tpc-slot-name {
  font-size: 10px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.tpc-slot-tip {
  position: fixed;
  z-index: 10050;
  transform: translate(-50%, -100%);
  min-width: 108px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
  color: var(--app-text-primary);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
}
.tpc-slot-tip-title {
  margin-bottom: 2px;
  color: var(--app-text-secondary);
  font-weight: 600;
}
.tpc-slot-tip-empty {
  color: var(--app-text-muted);
}
.tpc-corner-tip {
  min-width: 200px;
}
.tpc-corner-tip-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: baseline;
  gap: 6px;
}
.tpc-corner-tip-shape {
  font-weight: 600;
}
.tpc-corner-tip-alias {
  color: var(--app-text-muted);
  font-size: 10px;
}
.tpc-corner-tip-value {
  color: var(--tpc-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tpc-corner-tip-range {
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}
.tpc-corner-tip-note {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--app-border);
  color: var(--app-text-muted);
  font-size: 10px;
}

.tpc-draw-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  gap: 8px;
}
.tpc-draw-title {
  margin: 0;
  font-size: 16px;
  color: var(--app-text-secondary);
}
.tpc-draw-desc {
  margin: 0;
  font-size: 12px;
}

.tpc-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  flex-shrink: 0;
  background: color-mix(in srgb, var(--app-card) 72%, transparent);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
}
.tpc-guide-text-btn {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: auto;
  padding: 2px 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
}
.tpc-guide-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  color: inherit;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 14%, transparent);
}
.tpc-guide-text-btn:hover,
.tpc-guide-text-btn:focus-visible {
  color: var(--tpc-accent);
  background: transparent;
  border-color: transparent;
  outline: none;
}
.tpc-guide-text-btn:hover .tpc-guide-mark,
.tpc-guide-text-btn:focus-visible .tpc-guide-mark {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tpc-accent) 45%, transparent);
}
.tpc-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 510;
  letter-spacing: -0.01em;
  color: var(--app-text-secondary);
  user-select: none;
}
.tpc-confirm input {
  accent-color: var(--tpc-apple-green);
}
.tpc-confirm-help {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: -4px;
  padding: 0;
  font-size: 12px;
  font-weight: 650;
  font-family: inherit;
  line-height: 1;
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-text-primary) 7%, transparent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-confirm-help:hover,
.tpc-confirm-help:focus-visible {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--tpc-apple-blue) 40%, transparent);
  outline: none;
}
.tpc-status {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--app-text-muted);
  flex-shrink: 1;
  min-width: 0;
}
.tpc-file-ops {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tpc-file {
  display: none;
}

.tpc-btn,
.tpc-btn-sm {
  border: 0;
  border-radius: 8px;
  background: var(--tpc-apple-fill);
  color: var(--tpc-apple-blue);
  cursor: pointer;
  font-size: 12px;
  font-weight: 590;
  letter-spacing: -0.01em;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.tpc-btn {
  padding: 6px 14px;
}
.tpc-btn-sm {
  padding: 4px 10px;
  border-radius: 7px;
}
.tpc-btn:hover:not(:disabled),
.tpc-btn-sm:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
  color: var(--tpc-apple-blue);
}
.tpc-btn:disabled,
.tpc-btn-sm:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.tpc-btn.ghost {
  color: var(--app-text-secondary);
}
.tpc-btn.ghost:hover:not(:disabled) {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-btn.primary,
.tpc-btn.start {
  border: 0;
  background: var(--tpc-apple-blue);
  color: #fff;
  font-weight: 650;
  border-radius: 8px;
  box-shadow: none;
}
.tpc-btn.primary:hover:not(:disabled),
.tpc-btn.start:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-blue) 88%, #000);
  color: #fff;
}
.tpc-btn-sm.add {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
}

.tpc-dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 28%, transparent);
  backdrop-filter: blur(28px) saturate(1.4);
  -webkit-backdrop-filter: blur(28px) saturate(1.4);
}
.tpc-dlg-card {
  width: 420px;
  max-width: 92vw;
  background: color-mix(in srgb, var(--app-card) 78%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 16px;
  padding: 18px 16px 16px;
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 28%, transparent) inset,
    0 18px 50px color-mix(in srgb, #000 16%, transparent);
  backdrop-filter: blur(40px) saturate(1.6);
  -webkit-backdrop-filter: blur(40px) saturate(1.6);
  color: var(--app-text-primary);
}
.tpc-dlg-wide {
  width: 520px;
}
.tpc-dlg-head {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
  margin-bottom: 8px;
}
.tpc-dlg-body {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--app-text-secondary);
}
.tpc-dlg-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--app-text-muted);
  margin-bottom: 14px;
  font-variant-numeric: tabular-nums;
}
.tpc-dlg-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tpc-start-list {
  max-height: 280px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.tpc-start-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0.5px solid color-mix(in srgb, #fff 28%, var(--app-border));
  border-radius: 10px;
  background: var(--tpc-apple-fill);
  cursor: pointer;
}
.tpc-start-item.selected {
  border-color: color-mix(in srgb, var(--tpc-apple-blue) 45%, var(--app-border));
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
}
.tpc-start-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tpc-start-index {
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-start-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-start-name {
  font-size: 13px;
  color: var(--app-text-primary);
}
.tpc-start-meta {
  font-size: 11px;
  color: var(--app-text-muted);
}
</style>
