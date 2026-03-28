<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import RouteTabs from '../components/RouteTabs.vue'
import HomeUserBar from '../components/HomeUserBar.vue'
import RecipeParameterPanel from '../components/HomeRecipeParameterPanel.vue'
import DriverControlPanel from '../components/DriverControlPanel.vue'
import LaserControlPanel from '../components/LaserControlPanel.vue'
import CameraControlPanel from '../components/CameraControlPanel.vue'
import AuxiliaryFunctionPanel from '../components/AuxiliaryFunctionPanel.vue'
import HomeOperationHelp from '../components/HomeOperationHelp.vue'
import CameraPic from '../components/cameraPic.vue'
import ShowAndDrawInHome from '../components/showAndDrawInHome.vue'
import TaskProgressAside from '../components/TaskProgressAside.vue'
import { deviceFeatureRoutes } from '../configs/settings'
import { useNotification } from '../composables/useNotification'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import { useQomo5PStore } from '../stores/qomo5pEditor'
import { bootstrapControllerOnce } from '../utils/backendBootstrap'
import { subscribeGlobalKeyboard } from '../utils/globalKeyboard'
import {
  setMotionIoOutput,
  moveMotionAxisRel,
  startProgram,
  getStartProgramStatus,
  startProgramControl
} from '../utils/motionApi'

const featureLinks = deviceFeatureRoutes
const controllerSettingsStore = useControllerSettingsStore()
const { error, success } = useNotification()
const qomo5pStore = useQomo5PStore()
const { entities } = storeToRefs(qomo5pStore)

const Qkey = ref(false)
const Wkey = ref(false)
const Ekey = ref(false)
const Rkey = ref(false)
const moveStep = ref(1)
const programRunning = ref(false)
const programPaused = ref(false)
const programTaskCount = ref(0)
const currentTaskIndex = ref(0)
const currentTaskJindubaifenbi = ref(0)
let programStatusPollTimer: ReturnType<typeof setInterval> | null = null
let programElapsedTimer: ReturnType<typeof setInterval> | null = null

const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'
const programStartedAtMs = ref<number | null>(null)
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

function handleRunRecipeChange(payload: Record<string, unknown> | null): void {
  currentRunRecipePayload.value = payload
}

function loadProgramStartedAtFromStorage(): number | null {
  try {
    const raw = window.localStorage.getItem(PROGRAM_STARTED_AT_STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  } catch {
    return null
  }
}

function persistProgramStartedAtToStorage(ms: number | null): void {
  try {
    if (ms === null) window.localStorage.removeItem(PROGRAM_STARTED_AT_STORAGE_KEY)
    else window.localStorage.setItem(PROGRAM_STARTED_AT_STORAGE_KEY, String(Math.floor(ms)))
  } catch {
    // ignore storage errors
  }
}

function stopProgramElapsedTimer(): void {
  if (programElapsedTimer !== null) {
    clearInterval(programElapsedTimer)
    programElapsedTimer = null
  }
}

function startProgramElapsedTimer(): void {
  stopProgramElapsedTimer()
  programElapsedTimer = setInterval(() => {
    if (!programRunning.value || !programStartedAtMs.value) return
    programElapsedMs.value = Date.now() - programStartedAtMs.value
  }, 1000)
  // run once immediately
  if (programRunning.value && programStartedAtMs.value) {
    programElapsedMs.value = Date.now() - programStartedAtMs.value
  }
}

function stopProgramStatusPolling(): void {
  if (programStatusPollTimer !== null) {
    clearInterval(programStatusPollTimer)
    programStatusPollTimer = null
  }
}

function startProgramStatusPolling(): void {
  stopProgramStatusPolling()
  programStatusPollTimer = setInterval(async () => {
    const st = await getStartProgramStatus()
    if (!st?.success) {
      return
    }
    const data = st.data as {
      running?: boolean
      paused?: boolean
      total_tasks?: number
      current_task_index?: number
      jindubaifenbi?: number
    } | undefined
    if (data && typeof data.running === 'boolean') {
      programRunning.value = data.running
      programPaused.value = Boolean(data.paused)
    }
    if (typeof data?.total_tasks === 'number') {
      programTaskCount.value = Math.max(0, Math.floor(data.total_tasks))
    }
    if (typeof data?.current_task_index === 'number') {
      currentTaskIndex.value = Math.max(0, Math.floor(data.current_task_index))
    }
    if (typeof data?.jindubaifenbi === 'number') {
      currentTaskJindubaifenbi.value = Math.max(0, data.jindubaifenbi)
    }
    if (data?.running === false) {
      stopProgramStatusPolling()
      programPaused.value = false
      stopProgramElapsedTimer()
      programStartedAtMs.value = null
      programElapsedMs.value = 0
      persistProgramStartedAtToStorage(null)
    }
  }, 400)
}

async function syncProgramStatusOnEnter(): Promise<void> {
  const st = await getStartProgramStatus()
  if (!st?.success) return
  const data = st.data as {
    running?: boolean
    paused?: boolean
    total_tasks?: number
    current_task_index?: number
    jindubaifenbi?: number
  } | undefined

  if (typeof data?.running === 'boolean') {
    programRunning.value = data.running
    programPaused.value = Boolean(data.paused)
  }
  if (typeof data?.total_tasks === 'number') {
    programTaskCount.value = Math.max(0, Math.floor(data.total_tasks))
  }
  if (typeof data?.current_task_index === 'number') {
    currentTaskIndex.value = Math.max(0, Math.floor(data.current_task_index))
  }
  if (typeof data?.jindubaifenbi === 'number') {
    currentTaskJindubaifenbi.value = Math.max(0, data.jindubaifenbi)
  }

  if (data?.running === true) {
    const persisted = loadProgramStartedAtFromStorage()
    if (persisted) {
      programStartedAtMs.value = persisted
    } else {
      programStartedAtMs.value = Date.now()
      persistProgramStartedAtToStorage(programStartedAtMs.value)
    }
    startProgramElapsedTimer()
    startProgramStatusPolling()
  } else if (data?.running === false) {
    stopProgramStatusPolling()
    stopProgramElapsedTimer()
    programStartedAtMs.value = null
    programElapsedMs.value = 0
    persistProgramStartedAtToStorage(null)
  }
}

async function onRunClick(): Promise<void> {
  if (!currentRunRecipePayload.value) {
    error('运行失败：当前没有可下发的配方，请先选择有效主配方。')
    return
  }
  if (programRunning.value) return

  try {
    const entities = qomo5pStore.exportEntitiesToHomeVue()
    const payload = {
      recipe_payload: currentRunRecipePayload.value,
      entities: entities
    }
    const result = await startProgram(payload)
    if (!result?.success) {
      error(result?.message || '运行失败：后端未接受配方。')
      return
    }
    const data = result?.data as { task_count?: number } | undefined
    const tc = typeof data?.task_count === 'number' ? data.task_count : 0
    programTaskCount.value = tc
    programRunning.value = true
    programPaused.value = false
    programStartedAtMs.value = Date.now()
    programElapsedMs.value = 0
    persistProgramStartedAtToStorage(programStartedAtMs.value)
    startProgramElapsedTimer()
    startProgramStatusPolling()
    success(result?.message || '运行指令已发送。')
  } catch {
    error('运行失败：无法连接后端。')
  }
}

async function onPauseToggleClick(): Promise<void> {
  if (!programRunning.value) {
    error('当前没有运行中的程序。')
    return
  }
  const action = programPaused.value ? 'resume' : 'pause'
  const r = await startProgramControl(action)
  if (!r?.success) {
    error(r?.message || '暂停/继续操作失败。')
    return
  }
  success(r?.message || '已执行。')
  const st = await getStartProgramStatus()
  const d = st?.data as { paused?: boolean } | undefined
  if (typeof d?.paused === 'boolean') {
    programPaused.value = d.paused
  }
}

async function onResetAlarmsClick(): Promise<void> {
  const r = await startProgramControl('reset')
  if (!r?.success) {
    error(r?.message || '复位清除报警失败。')
    return
  }
  success(r?.message || '报警已清除。')
}

async function onEstopClick(): Promise<void> {
  const r = await startProgramControl('estop')
  if (!r?.success) {
    error(r?.message || '急停指令失败。')
    return
  }
  success(r?.message || '已急停。')
  programRunning.value = false
  programPaused.value = false
  currentTaskIndex.value = 0
  currentTaskJindubaifenbi.value = 0
  stopProgramStatusPolling()
  stopProgramElapsedTimer()
  programStartedAtMs.value = null
  programElapsedMs.value = 0
  persistProgramStartedAtToStorage(null)
}

async function onSkipTaskClick(): Promise<void> {
  if (programTaskCount.value < 2) return
  const r = await startProgramControl('skip')
  if (!r?.success) {
    error(r?.message || '跳过当前任务失败。')
    return
  }
  success(r?.message || '已请求跳过。')
}

const unsubscribeKeyboard = subscribeGlobalKeyboard((e) => {

  const keyword = e.key.toUpperCase() 
  const onlyctrlKey = e.ctrlKey && !e.shiftKey&&!e.altKey
  const onlyshiftKey = e.shiftKey && !e.ctrlKey&&!e.altKey
  const nokey = !e.ctrlKey && !e.shiftKey&&!e.altKey
  const altKey = e.altKey&&!e.ctrlKey&&!e.shiftKey

  const isArrowKey = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT'].includes(keyword)

  // 实体联动：按上下左右移动所有实体
  // 需求：当是 shift + 方向键时，只移动图像，不发给后端（提前 return）
  if (isArrowKey) {
    if (entities.value.length > 0) {
      e.preventDefault()
      if (e.repeat) return
      const step = moveStep.value
      if (Number.isFinite(step) && step !== 0) {
        const dx =
          keyword === 'ARROWLEFT'
            ? step
            : keyword === 'ARROWRIGHT'
              ? -step
              : 0
        const dy =
          keyword === 'ARROWDOWN'
            ? step
            : keyword === 'ARROWUP'
              ? -step
              : 0
        if (dx !== 0 || dy !== 0) {
          qomo5pStore.beginInteractiveTransform()
          qomo5pStore.moveAllEntitiesInPlace(dx, dy)
          qomo5pStore.endInteractiveTransform()
        }
      }
    }

    if (onlyshiftKey) return
  }

  if (keyword === 'ARROWUP' && altKey) {
    e.preventDefault()
    console.log('ARROWUP1')
    void moveMotionAxisRel(1, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWDOWN' && altKey) {
    e.preventDefault()
    void moveMotionAxisRel(1, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWLEFT' && altKey) {
    e.preventDefault()
    void moveMotionAxisRel(0, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWRIGHT' && altKey) {
    e.preventDefault()
    void moveMotionAxisRel(0, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'PAGEUP' && altKey) {
    e.preventDefault()
    void moveMotionAxisRel(2, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'PAGEDOWN' && altKey) {
    e.preventDefault()
    void moveMotionAxisRel(2, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }


  if (e.repeat) return
  if (keyword === 'F1' && nokey) {
    e.preventDefault()
    moveStep.value = 0.01
    success('速度设置为0.01mm/s')
  }
  if (keyword === 'F2' && nokey) {
    e.preventDefault()
    moveStep.value = 0.1
    success('速度设置为0.1mm/s')
  }
  if (keyword === 'F3' && nokey) {
    e.preventDefault()
    moveStep.value = 1
    success('速度设置为1mm/s')
  }
  if (keyword === 'F4' && nokey) {
    e.preventDefault()
    moveStep.value = 5
    success('速度设置为5mm/s')
  }

  if (keyword === 'ARROWUP' && nokey) {
    e.preventDefault()
    console.log('ARROWUP2')
    void moveMotionAxisRel(1, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWDOWN' && nokey) {
    e.preventDefault()
    void moveMotionAxisRel(1, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWLEFT' && nokey) {
    e.preventDefault()
    void moveMotionAxisRel(0, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWRIGHT' && nokey) {
    e.preventDefault()
    void moveMotionAxisRel(0, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'PAGEUP' && nokey) {
    e.preventDefault()
    void moveMotionAxisRel(2, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'PAGEDOWN' && nokey) {
    e.preventDefault()
    void moveMotionAxisRel(2, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  


  if (keyword === 'ARROWUP' && onlyctrlKey) {
    e.preventDefault()
    void moveMotionAxisRel(3, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWDOWN' && onlyctrlKey) {
    e.preventDefault()
    void moveMotionAxisRel(3, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWLEFT' && onlyctrlKey) {
    e.preventDefault()
    void moveMotionAxisRel(4, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }
  if (keyword === 'ARROWRIGHT' && onlyctrlKey) {
    e.preventDefault()
    void moveMotionAxisRel(4, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
  }

  if (keyword === 'Q'&& nokey) {
    e.preventDefault()
    void (async () => {await setMotionIoOutput(0, !Qkey.value)})()
    Qkey.value = !Qkey.value
    success('吹气状态设置为' + Qkey.value)
  }
  if (keyword === 'W'&& nokey) {
    e.preventDefault()
    void (async () => {await setMotionIoOutput(1, !Wkey.value)})()
    Wkey.value = !Wkey.value
    success('灯光状态设置为' + Wkey.value)
  }
  if (keyword === 'E'&& onlyctrlKey) {
    e.preventDefault()
    void (async () => {await setMotionIoOutput(2, !Ekey.value)})()
    Ekey.value = !Ekey.value
    success('激光状态设置为', Ekey.value ? '开启' : '关闭')
  }
  if (keyword === 'R'&& nokey) {
    e.preventDefault()
    void (async () => {
      await setMotionIoOutput(2, !Rkey.value)
      Rkey.value = true
      await new Promise(resolve => setTimeout(resolve, 500))
      await setMotionIoOutput(2, !Rkey.value)
      Rkey.value = false
    })()
    success('点射激光', Rkey.value ? '开启' : '关闭')
  }
})

onUnmounted(() => {
  unsubscribeKeyboard()
  stopProgramStatusPolling()
  stopProgramElapsedTimer()
})

onMounted(async () => {
  await controllerSettingsStore.loadControllerSettings()
  try {
    const controllerRes = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
    if (!controllerRes.success) {
      error(controllerRes.message)
    }
  } catch {
    error('控制器初始化失败：无法连接后端或硬件未就绪。')
  }
  try {
    await syncProgramStatusOnEnter()
  } catch {
    // ignore enter sync errors (e.g. backend temporarily unreachable)
  }
})
</script>

<template>
  <div class="app-page relative min-h-screen">
    <div class="absolute right-6 top-6 z-10">
      <HomeUserBar />
    </div>

    <div class="absolute left-36 top-2 z-10">
      <RouteTabs :links="featureLinks" :show-home-link="false" />
    </div>

    <div class="fixed left-1/2 top-[10%] z-50 flex -translate-x-1/2 transform space-x-4">
      <button
        class="z-50 h-16 w-16 rounded-2xl bg-green-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-green-300 hover:bg-green-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
        @keydown.enter.prevent
        :disabled="programRunning"
        @click="onRunClick"
      >
        运行
      </button>
      <button
        class="z-50 h-16 w-16 rounded-2xl bg-yellow-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-yellow-300 hover:bg-yellow-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
        @keydown.enter.prevent
        :disabled="!programRunning"
        @click="onPauseToggleClick"
      >
        {{ programPaused ? '继续' : '暂停' }}
      </button>
      <button
        class="z-50 h-16 w-16 rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-blue-300 hover:bg-blue-800 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
        @keydown.enter.prevent
        @click="onResetAlarmsClick"
      >
        复位
      </button>
      <button
        class="z-50 h-16 w-16 rounded-2xl bg-red-700 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-red-300 hover:bg-red-800 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
        @keydown.enter.prevent
        @click="onEstopClick"
      >
        急停
      </button>
      <button
        v-if="programTaskCount >= 2"
        class="z-50 h-16 w-16 rounded-2xl bg-orange-600 text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 hover:border-orange-300 hover:bg-orange-700 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
        @keydown.enter.prevent
        :disabled="!programRunning"
        @click="onSkipTaskClick"
      >
        跳过
      </button>
    </div>

    <section
      class="absolute left-4 top-24 bottom-4 z-20 flex min-h-0 w-[450px] flex-col gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <RecipeParameterPanel @run-recipe-change="handleRunRecipeChange" />
      <DriverControlPanel />
      <LaserControlPanel />
      <CameraControlPanel />
      <AuxiliaryFunctionPanel />
    </section>

    <main class="absolute inset-x-[470px] top-20 bottom-4 z-10 p-3">
      <div
        class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-transparent shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
      >
        <CameraPic object-fit="cover" />
        <!-- 透明叠加层：中心十字 + 实体线段绘制，不遮挡相机画面 -->
        <ShowAndDrawInHome :scale="1" />
      </div>
    </main>


    
    <aside
      class="absolute right-20 top-20 bottom-4 z-20 flex min-h-0 w-96 max-w-[calc(100vw-2rem)] flex-col p-3"
      aria-label="操作帮助区域"
    >
      <HomeOperationHelp :program-running="programRunning" :program-elapsed-text="programElapsedText" />
    </aside>

    <TaskProgressAside
      :task-count="programTaskCount"
      :current-task-index="currentTaskIndex"
      :jindubaifenbi="currentTaskJindubaifenbi"
      :running="programRunning"
    />
  </div>
</template>
