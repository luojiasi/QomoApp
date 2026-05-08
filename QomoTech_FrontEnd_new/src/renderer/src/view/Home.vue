<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import RouteTabs from '../components/RouteTabs.vue'
import HomeUserBar from '../components/HomeUserBar.vue'
import RecipeParameterPanel from '../components/HomeRecipeParameterPanel.vue'
import DriverControlPanel from '../components/DriverControlPanel.vue'
import AuxiliaryFunctionPanel from '../components/AuxiliaryFunctionPanel.vue'
import HomeOperationHelp from '../components/HomeOperationHelp.vue'
import StratProgramRunning from '../components/StratProgramRunning.vue'
import ShowAndDrawInHome from '../components/showAndDrawInHome.vue'
import TaskProgressAside from '../components/TaskProgressAside.vue'
import ControllerSettings from './ControllerSettings.vue'
import SvgIcon from '@/components/SvgIcon.vue'

import ShowAndDrawInHome_new from '../components/showAndDrawInHome_new.vue'
import HomeOperationHelp_new from '../components/HomeOperationHelp_new.vue'
const newWayToCreateGraphic = ref(true)

import { useAuxiliaryFunctionPanelStore } from '../stores/auxiliaryFunctionPanelStore'
const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

import { deviceFeatureRoutes } from '../configs/settings'
const featureLinks = deviceFeatureRoutes

import { useNotification } from '../composables/useNotification'
const { error, success } = useNotification()

import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
const controllerSettingsStore = useControllerSettingsStore()

import { useQomo5PStore } from '../stores/qomo5pEditor'
const qomo5pStore = useQomo5PStore()

import { bootstrapControllerOnce } from '../utils/backendBootstrap'
import { getDesktopBackendRuntimeStatus, type BackendRuntimeStatus } from '../utils/desktopBridge'
const backendStatus = ref<BackendRuntimeStatus>({
  state: 'starting',
  isReachable: false,
  message: '正在检测后台服务...'
})
const BACKEND_POLL_MS = 2000
let backendPollTimer: ReturnType<typeof setInterval> | undefined
const refreshBackendStatus = async (): Promise<void> => {
  backendStatus.value = await getDesktopBackendRuntimeStatus()
}
const backendDotClass = computed(() => {
  switch (backendStatus.value.state) {
    case 'running': return 'bg-green-500'
    case 'starting': case 'restarting': return 'bg-yellow-500'
    default: return 'bg-red-500'
  }
})

import { subscribeGlobalKeyboard } from '../utils/globalKeyboard'
import {
  moveAxisRel,
  moveAxisAbs,
  motionPause,
  motionResume,
  motionStop,
  motionEstop,
  motionReset,
  getMotionState,
} from '../utils/motionApi'

type ControllerRuntimeState = 'checking' | 'connected' | 'disconnected'
const controllerStatus = ref<{ state: ControllerRuntimeState; isConnected: boolean; message: string }>({
  state: 'checking',
  isConnected: false,
  message: '正在检测控制器连接...'
})

const CONTROLLER_POLL_MS = 2000
let controllerPollTimer: ReturnType<typeof setInterval> | undefined

const controllerDotClass = computed(() => {
  switch (controllerStatus.value.state) {
    case 'connected': return 'bg-green-500'
    case 'checking': return 'bg-yellow-500'
    default: return 'bg-red-500'
  }
})

const refreshControllerStatus = async (): Promise<void> => {
  if (backendStatus.value.state !== 'running') {
    controllerStatus.value = { state: 'disconnected', isConnected: false, message: '后台未连接，控制器状态不可用' }
    return
  }
  const res = await getMotionState()
  const isConnected = Boolean(res?.success && res?.data?.state !== 'DISCONNECTED')
  if (isConnected) {
    controllerStatus.value = { state: 'connected', isConnected: true, message: '控制器已连接' }
  } else {
    const reason = res?.data?.error ?? res?.message ?? '控制器未连接'
    controllerStatus.value = { state: 'disconnected', isConnected: false, message: String(reason) }
  }
}

const onRefreshClick = async (): Promise<void> => {
  const result = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
  if (result?.success) {
    success('控制器重连成功')
  } else {
    error('控制器重连失败')
  }
}

const axisStatusLabels = computed(() => {
  const axisNames = ['X', 'Y', 'Z', 'R', 'U']
  return axisNames.map((name, axisNo) => {
    const axis = controllerSettingsStore.controllerSettings.axes.find((a) => a.axisNo === axisNo)
    const status = axis ? Number(axis.axisstatus) : NaN
    if (!Number.isFinite(status)) return { status, label: `${name}: 未知` }
    const labels: string[] = []
    if ((status & 16) !== 0) labels.push('正向硬限位异常')
    if ((status & 32) !== 0) labels.push('负向硬限位异常')
    if (labels.length === 0) return { status, label: `${name}: 正常` }
    return { status, label: `${name}: ${labels.join('，')}` }
  })
})

const rightPanelViewId = ref<string | null>(null)
const rightPanelViewComponent = computed(() => {
  if (!rightPanelViewId.value) return null
  switch (rightPanelViewId.value) {
    case 'ControllerSettings': return ControllerSettings
    default: return null
  }
})
function openRightPanel(target: string): void { rightPanelViewId.value = target }
function closeRightPanel(): void { rightPanelViewId.value = null }

// Keyboard shortcuts
const moveStep = ref(1)
const programRunning = ref(false)
const programPaused = ref(false)
const programTaskCount = ref(0)
const currentTaskIndex = ref(0)
const currentTaskJindubaifenbi = ref(0)
const programElapsedMs = ref(0)

function formatElapsedMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(safe / 1000)
  const hh = Math.floor(totalSeconds / 3600)
  const mm = Math.floor((totalSeconds % 3600) / 60)
  const ss = totalSeconds % 60
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
}

const programElapsedText = computed(() => formatElapsedMs(programElapsedMs.value))

const currentRunRecipePayload = ref<Record<string, unknown> | null>(null)
const recipeUpperOpeningMm = ref<number | null>(null)

function handleRunRecipeChange(payload: Record<string, unknown> | null): void {
  currentRunRecipePayload.value = payload
}
function handleUpperOpeningChange(mm: number | null): void {
  recipeUpperOpeningMm.value = mm
}

type XYMotionOffset = { x: number; y: number }
const homeXyOffset = ref<XYMotionOffset>({ x: 0, y: 0 })
const runTrigger = ref(false)

async function onRunClick(): Promise<void> {
  if (programRunning.value) return
  programRunning.value = true
  programPaused.value = false
  programTaskCount.value = 0
  currentTaskIndex.value = 0
  runTrigger.value = true
  success('运行', '自定流程已启动')
}

async function onPauseToggleClick(): Promise<void> {
  if (!programRunning.value) { error('当前没有运行中的程序。'); return }
  const action = programPaused.value ? motionResume : motionPause
  const r = await action()
  if (!r?.success) { error(r?.message || '操作失败。'); return }
  programPaused.value = !programPaused.value
  success(r?.message || '已执行。')
}

async function onResetAlarmsClick(): Promise<void> {
  const r = await motionReset()
  if (!r?.success) { error(r?.message || '复位清除报警失败。'); return }
  success(r?.message || '报警已清除。')
}

async function onEstopClick(): Promise<void> {
  const r = await motionEstop()
  if (!r?.success) { error(r?.message || '急停指令失败。'); return }
  success(r?.message || '已急停。')
  runTrigger.value = false
  programRunning.value = false
  programPaused.value = false
  currentTaskIndex.value = 0
  currentTaskJindubaifenbi.value = 0
  programElapsedMs.value = 0
}

async function onSkipTaskClick(): Promise<void> {
  error('暂未实现', '跳过功能待后端实现')
}

function getAxisName(axisNo: number): string {
  const map: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }
  return map[axisNo] ?? 'X'
}

const unsubscribeKeyboard = subscribeGlobalKeyboard((e) => {
  const keyword = e.key.toUpperCase()
  const onlyctrlKey = e.ctrlKey && !e.shiftKey && !e.altKey
  const nokey = !e.ctrlKey && !e.shiftKey && !e.altKey
  const altKey = e.altKey && !e.ctrlKey && !e.shiftKey

  if (keyword === 'ARROWUP' && altKey) {
    e.preventDefault()
    void moveAxisRel('Y', -moveStep.value)
  }
  if (keyword === 'ARROWDOWN' && altKey) {
    e.preventDefault()
    void moveAxisRel('Y', moveStep.value)
  }
  if (keyword === 'ARROWLEFT' && altKey) {
    e.preventDefault()
    void moveAxisRel('X', moveStep.value)
  }
  if (keyword === 'ARROWRIGHT' && altKey) {
    e.preventDefault()
    void moveAxisRel('X', -moveStep.value)
  }
  if (keyword === 'PAGEUP' && altKey) {
    e.preventDefault()
    void moveAxisRel('Z', moveStep.value)
  }
  if (keyword === 'PAGEDOWN' && altKey) {
    e.preventDefault()
    void moveAxisRel('Z', -moveStep.value)
  }

  if (e.repeat) return

  if (keyword === 'H' && nokey) {
    e.preventDefault()
    void (async () => {
      try {
        const quickMoveToPosition = auxiliaryFunctionPanelStore.loadAuxiliaryFunctionPanelQuickMoveToPosition()
        if (!quickMoveToPosition) { error('未找到设定点'); return }
        if (quickMoveToPosition.X === 0 && quickMoveToPosition.Y === 0 && quickMoveToPosition.Z === 0) {
          error('请设定位置点快捷移动到指定位置'); return
        }
        const [zx, zy, zz] = await Promise.all([
          moveAxisAbs('X', quickMoveToPosition.X),
          moveAxisAbs('Y', quickMoveToPosition.Y),
          moveAxisAbs('Z', quickMoveToPosition.Z),
        ])
        if (!zx?.success || !zy?.success || !zz?.success) { error('回到设定点失败'); return }
        homeXyOffset.value = { x: 0, y: 0 }
        success('已回到设定点')
      } catch { error('回到设定点失败') }
    })()
    return
  }
  if (keyword === 'F1' && nokey) { e.preventDefault(); moveStep.value = 0.01; success('速度设置为0.01') }
  if (keyword === 'F2' && nokey) { e.preventDefault(); moveStep.value = 0.1; success('速度设置为0.1') }
  if (keyword === 'F3' && nokey) { e.preventDefault(); moveStep.value = 1; success('速度设置为1') }
  if (keyword === 'F4' && nokey) { e.preventDefault(); moveStep.value = 5; success('速度设置为5') }

  if (keyword === 'ARROWUP' && nokey) { e.preventDefault(); void moveAxisRel('Y', -moveStep.value) }
  if (keyword === 'ARROWDOWN' && nokey) { e.preventDefault(); void moveAxisRel('Y', moveStep.value) }
  if (keyword === 'ARROWLEFT' && nokey) { e.preventDefault(); void moveAxisRel('X', moveStep.value) }
  if (keyword === 'ARROWRIGHT' && nokey) { e.preventDefault(); void moveAxisRel('X', -moveStep.value) }
  if (keyword === 'PAGEUP' && nokey) { e.preventDefault(); void moveAxisRel('Z', moveStep.value) }
  if (keyword === 'PAGEDOWN' && nokey) { e.preventDefault(); void moveAxisRel('Z', -moveStep.value) }

  if (keyword === 'ARROWUP' && onlyctrlKey) { e.preventDefault(); void moveAxisRel('U', moveStep.value * 18) }
  if (keyword === 'ARROWDOWN' && onlyctrlKey) { e.preventDefault(); void moveAxisRel('U', -moveStep.value * 18) }
  if (keyword === 'ARROWLEFT' && onlyctrlKey) { e.preventDefault(); void moveAxisRel('R', -moveStep.value) }
  if (keyword === 'ARROWRIGHT' && onlyctrlKey) { e.preventDefault(); void moveAxisRel('R', moveStep.value) }

  if (keyword === 'Q' && nokey) { e.preventDefault(); error('IO 接口待后端实现', '吹气暂不可用') }
  if (keyword === 'W' && nokey) { e.preventDefault(); error('IO 接口待后端实现', '灯光暂不可用') }
  if (keyword === 'E' && onlyctrlKey) { e.preventDefault(); error('IO 接口待后端实现', '激光暂不可用') }
  if (keyword === 'R' && nokey) { e.preventDefault(); error('IO 接口待后端实现', '点射激光暂不可用') }
})

onUnmounted(() => {
  unsubscribeKeyboard()
  if (backendPollTimer) { clearInterval(backendPollTimer); backendPollTimer = undefined }
  if (controllerPollTimer) { clearInterval(controllerPollTimer); controllerPollTimer = undefined }
})

onMounted(async () => {
  await refreshBackendStatus()
  await refreshControllerStatus()
  backendPollTimer = setInterval(() => { void refreshBackendStatus() }, BACKEND_POLL_MS)
  controllerPollTimer = setInterval(() => { void refreshControllerStatus() }, CONTROLLER_POLL_MS)

  await controllerSettingsStore.loadControllerSettings()
  try {
    const controllerRes = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
    if (!controllerRes.success) { error(controllerRes.message) }
  } catch { error('控制器初始化失败：无法连接后端或硬件未就绪。') }
})
</script>

<template>
    <div class="home-toolbar">
      <RouteTabs :links="featureLinks" :show-home-link="false" />
      <div class="home-toolbar-sep" />
      <div class="flex items-center gap-1">
        <span class="h-2 w-2 rounded-full" :class="backendDotClass" />
        <span class="text-xs text-(--app-text-secondary)">后台</span>
        <span class="h-2 w-2 rounded-full" :class="controllerDotClass" />
        <span class="text-xs text-(--app-text-secondary)">控制器</span>
      </div>
      <div class="home-toolbar-sep" />
      <button @click="onRefreshClick">
        <SvgIcon icon-name="icon-refresh" class-name="text-sm" />
      </button>
      <div class="home-toolbar-sep" />
      <div class="flex gap-3">
        <button
          class="z-50 h-10 w-16 rounded-2xl bg-green-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-green-300 hover:bg-green-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
          @keydown.enter.prevent
          :disabled="programRunning"
          @click="onRunClick"
        >
          运行
        </button>
        <button
          class="z-50 h-10 w-16 rounded-2xl bg-yellow-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-yellow-300 hover:bg-yellow-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
          @keydown.enter.prevent
          :disabled="!programRunning"
          @click="onPauseToggleClick"
        >
          {{ programPaused ? '继续' : '暂停' }}
        </button>
        <button
          class="z-50 h-10 w-16 rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-blue-300 hover:bg-blue-800 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
          @keydown.enter.prevent
          @click="onResetAlarmsClick"
        >
          复位
        </button>
        <button
          class="z-50 h-10 w-16 rounded-2xl bg-red-700 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-red-300 hover:bg-red-800 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
          @keydown.enter.prevent
          @click="onEstopClick"
        >
          急停
        </button>
        <button
          v-if="programTaskCount >= 2"
          class="z-50 h-10 w-16 rounded-2xl bg-orange-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-orange-300 hover:bg-orange-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
          @keydown.enter.prevent
          :disabled="!programRunning"
          @click="onSkipTaskClick"
        >
          跳过
        </button>
      </div>
      <div class="home-toolbar-sep" />
      <HomeUserBar />
      <div class="home-toolbar-sep" />
    </div>

    <section
      v-if="rightPanelViewComponent"
      class="absolute right-4 top-10 bottom-4 z-20 flex min-h-0 w-6/12 flex-col gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <component :is="rightPanelViewComponent" embedded @back="closeRightPanel" />
    </section>

    <div v-else>
      <section
        class="absolute right-4 top-16 bottom-4 z-20 flex min-h-0 w-[min(450px,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <StratProgramRunning
          :programRunning="programRunning"
          :programElapsedText="programElapsedText"
          :axisStatusLabels="axisStatusLabels"
        />
        <RecipeParameterPanel
          @run-recipe-change="handleRunRecipeChange"
          @upper-opening-change="handleUpperOpeningChange"
        />
        <DriverControlPanel @open-right-panel="openRightPanel" />
        <AuxiliaryFunctionPanel />
      </section>

      <aside
        class="absolute left-1/2 top-16 bottom-8 z-20 flex min-h-0 w-120 max-w-[calc(100vw-2rem)] flex-col p-3"
        aria-label="操作帮助区域"
      >
        <HomeOperationHelp v-if="!newWayToCreateGraphic"/>
        <HomeOperationHelp_new v-else />
      </aside>
    </div>

    <main class="absolute left-4 w-[940px] top-16 bottom-8 z-10 p-3">
      <div
        class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-transparent shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
      >
        <ShowAndDrawInHome :scale="1" :upper-opening-mm="recipeUpperOpeningMm" v-if="!newWayToCreateGraphic"/>
        <ShowAndDrawInHome_new
          v-else
          :scale="1"
          :upper-opening-mm="recipeUpperOpeningMm"
          :xy-offset="homeXyOffset"
          :run-trigger="runTrigger"
        />
      </div>
    </main>
    <div class="flex items-center gap-2 absolute left-8 bottom-4 w-[940px]">
      <TaskProgressAside
      :task-count="programTaskCount"
      :current-task-index="currentTaskIndex"
      :jindubaifenbi="currentTaskJindubaifenbi"
      :running="programRunning"
      />
    </div>
</template>
<style>
.home-toolbar {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 0;
  background-color: var(--app-card);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.home-toolbar::-webkit-scrollbar { display: none; }

.home-toolbar-sep {
  width: 1px;
  height: 24px;
  background-color: var(--app-border);
  margin: 0 10px;
  flex-shrink: 0;
}
</style>
