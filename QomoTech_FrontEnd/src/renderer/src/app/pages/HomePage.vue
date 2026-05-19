<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import RouteTabs from '@/shared/components/RouteTabs.vue'
import HomeUserBar from '@/modules/auth/components/HomeUserBar.vue'
import RecipeParameterPanel from '@/modules/recipe/panels/RecipeParameterPanel.vue'
import DriverControlPanel from '@/modules/motion/panels/DriverControlPanel.vue'
import LaserControlPanel from '@/modules/laser/pages/LaserControlPanel.vue'
import CameraControlPanel from '@/modules/camera/panels/CameraControlPanel.vue'
import AuxiliaryFunctionPanel from '@/modules/motion/panels/AuxiliaryPanel.vue'
import HomeOperationHelp from '@/modules/editor/panels/HomeOperationHelp.vue'
import StratProgramRunning from '@/modules/program/panels/StartProgramPanel.vue'
import CameraPic from '@/modules/camera/CameraPic.vue'
import ShowAndDrawInHome from '@/modules/editor/panels/ShowAndDrawPanel.vue'
import TaskProgressAside from '@/modules/program/panels/TaskProgressAside.vue'
import Show4PTable from '@/modules/motion/panels/Show4PTable.vue'
import ControllerSettings from '@/modules/motion/pages/ControllerSettingsPage.vue'
import DetailedRs232Send from '@/modules/laser/pages/LaserSettingsPage.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import StatusIndicators from '@/shared/components/StatusIndicators.vue'
import ProgramControlButtons from '@/modules/program/panels/ProgramControlButtons.vue'

import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '@/modules/motion/stores/useControllerSettingsStore'
import { deviceFeatureRoutes } from '@/app/router'
import { bootstrapControllerOnce } from '@/modules/motion/services/bootstrapService'
import { parseRs232SessionFromLocalStorage } from '@/modules/laser'
import { syncRs232Workbench } from '@/modules/laser'

import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'

const { error, success } = useNotification()
const controllerSettingsStore = useControllerSettingsStore()

const featureLinks = deviceFeatureRoutes

const {
  unsubscribe: unsubscribeKeyboard
} = useMotionKeyboard()

const {
  programRunning, 
  programPaused, 
  programTaskCount, 
  currentTaskIndex,
  currentTaskJindubaifenbi, 
  programElapsedText,
  recipeUpperOpeningMm,
  homeXyOffset, 
  runTrigger,
  handleRunRecipeChange, 
  handleUpperOpeningChange,
  onRunClick,
  on4PTableConfirm,
  on4PTableCancel,
  show4PDialogVisible,
  show4PIsAcquiring,
  show4PIsAcquired,
  show4PTablePosition,
  show4PAcquire,
  onPauseToggleClick,
  onResetAlarmsClick,
  onEstopClick,
  onSkipTaskClick,
  init: initProgramRunner,
  initSync: initProgramSync,
  cleanup: cleanupProgramRunner
} = useProgramRunner()

const rightPanelViewId = ref<string | null>(null)

const rightPanelViewComponent = computed(() => {
  if (!rightPanelViewId.value) return null
  switch (rightPanelViewId.value) {
    case 'ControllerSettings': return ControllerSettings
    case 'DetailedRs232Send': return DetailedRs232Send
    default: return null
  }
})

function openRightPanel(target: string): void {
  rightPanelViewId.value = target
}

function closeRightPanel(): void {
  rightPanelViewId.value = null
}

async function onRefreshClick(): Promise<void> {
  const result = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
  if (result?.success) {
    success('控制器重连成功')
  } else {
    error('控制器重连失败')
  }
  const workbenchPayload = parseRs232SessionFromLocalStorage()
  if (!workbenchPayload) {
    error('激光接口参数重连失败')
    return
  }
  await syncRs232Workbench(workbenchPayload)
  success('激光接口重连成功')
}


onMounted(async () => {
  initProgramRunner()

  await controllerSettingsStore.loadControllerSettings()
  try {
    const controllerRes = await bootstrapControllerOnce(controllerSettingsStore.controllerSettings)
    if (!controllerRes.success) {
      error(controllerRes.message)
    }
  } catch {
    error('控制器初始化失败：无法连接后端或硬件未就绪。')
  }

  await initProgramSync()
})

onUnmounted(() => {
  unsubscribeKeyboard()
  cleanupProgramRunner()
})
</script>

<template>
  <div class="home-toolbar">
    <RouteTabs :links="featureLinks" :show-home-link="false" />
    <div class="home-toolbar-sep" />
    <StatusIndicators />
    <div class="home-toolbar-sep" />
    <button @click="onRefreshClick">
      <SvgIcon icon-name="icon-refresh" class-name="text-sm" />
    </button>
    <div class="home-toolbar-sep" />
    <ProgramControlButtons
      :program-running="programRunning"
      :program-paused="programPaused"
      :program-task-count="programTaskCount"
      @run="onRunClick"
      @pause-toggle="onPauseToggleClick"
      @reset-alarms="onResetAlarmsClick"
      @estop="onEstopClick"
      @skip-task="onSkipTaskClick"
    />
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
      />
      <RecipeParameterPanel
        @run-recipe-change="handleRunRecipeChange"
        @upper-opening-change="handleUpperOpeningChange"
      />
      <DriverControlPanel @open-right-panel="openRightPanel" />
      <LaserControlPanel @open-right-panel="openRightPanel" />
      <CameraControlPanel />
      <AuxiliaryFunctionPanel />
    </section>

    <aside
      class="absolute left-1/2 top-16 bottom-8 z-20 flex min-h-0 w-120 max-w-[calc(100vw-2rem)] flex-col p-3"
      aria-label="操作帮助区域"
    >
      <HomeOperationHelp />
    </aside>
  </div>

  <main class="absolute left-4 w-[940px] top-16 bottom-8 z-10 p-3">
    <div
      class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-transparent shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    >
      <CameraPic object-fit="cover" />
      <ShowAndDrawInHome
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

  <Show4PTable
    :visible="show4PDialogVisible"
    :is-acquiring="show4PIsAcquiring"
    :is-acquired="show4PIsAcquired"
    :table-position="show4PTablePosition"
    @acquire="show4PAcquire"
    @confirm="on4PTableConfirm"
    @cancel="on4PTableCancel"
  />
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
