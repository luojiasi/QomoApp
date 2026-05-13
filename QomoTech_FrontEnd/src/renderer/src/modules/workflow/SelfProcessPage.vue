<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSelfProcessStore } from '@/stores/selfProcessStores'
import FlowTaskPanel from '@/features/workflow/FlowTaskPanel.vue'
import FlowCanvas from '@/features/workflow/FlowCanvas.vue'
import FlowNodeConfig from '@/features/workflow/FlowNodeConfig.vue'
import FlowLogPanel from '@/features/workflow/FlowLogPanel.vue'
import FlowCanvasConfig from '@/features/workflow/FlowCanvasConfig.vue'
import MotionController from '@/features/workflow/MotionController.vue'
import CameraPic from '@/features/camera/cameraPic.vue'

const store = useSelfProcessStore()
const sidePanelTab = ref<'log' | 'config' | 'canvasConfig' | 'motionController'>('config')

onMounted(async () => {
  await store.init()
})
</script>

<template>
  <div
      class="flex shrink-0 items-center gap-4 rounded-2xl border border-(--app-border) bg-(--app-card) px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
    >
      <div class="flex min-w-[220px] flex-col gap-0.5">
        <h1 class="text-lg font-bold leading-tight text-(--app-text-primary)">自定流程</h1>
        <span class="text-xs text-(--app-text-muted)">
          {{ store.currentWorkflow ? store.currentWorkflow.name : '创建流程后开始编排节点' }}
        </span>
      </div>
      <div class="flex flex-1 justify-center gap-2">
        <button
          class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white opacity-100 shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition-all duration-100 enabled:hover:-translate-y-px enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          :disabled="!store.currentWorkflow || store.isSaving"
          @click="store.saveWorkflow()"
        >
          {{ store.isSaving ? '保存中...' : '保存流程' }}
        </button>
        <button
          v-if="!store.isRunning"
          class="cursor-pointer rounded-lg border border-green-500/30 bg-green-600 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(22,163,74,0.18)] transition-all duration-100 enabled:hover:-translate-y-px enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          :disabled="!store.currentWorkflow || store.currentWorkflow.nodes.length === 0"
          @click="store.runWorkflow()"
        >
          运行
        </button>
        <button
          v-else
          class="cursor-pointer rounded-lg border border-red-500/30 bg-red-600 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.2)] transition-all duration-100 hover:-translate-y-px hover:bg-red-700"
          @click="store.stopWorkflow()"
        >
          停止
        </button>
      </div>
      <div class="flex items-center">
        <RouterLink
          to="/home"
          class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-25 py-2 text-[13px] text-(--app-text-muted) no-underline transition-colors duration-100 hover:text-(--app-text-primary)"
        >
          返回首页
        </RouterLink>
      </div>
    </div>
  <div class="absolute top-1/16 bottom-4 z-20 flex min-h-0 w-full flex-row gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <aside class="h-full w-1/8 overflow-hidden">
      <FlowTaskPanel />
    </aside>


    <main class="h-full w-3/4 flex-col items-center overflow-hidden">
        <div class="h-full w-full shrink-0">
          <FlowCanvas class="h-full w-full" />
        </div>
      </main>


    <aside class="flex h-full w-2/9 flex-col overflow-hidden">
      <div class="h-2/5 overflow-hidden rounded-xl border border-(--app-border)">
        <CameraPic object-fit="cover" />
      </div>
      <div class="h-3/5 overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card)">
        <div class="flex items-center gap-2 border-b border-(--app-border) p-2">
          <button
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="sidePanelTab === 'log'
              ? 'bg-blue-600 text-white'
              : 'bg-(--app-card-soft) text-(--app-text-secondary) hover:text-(--app-text-primary)'"
            @click="sidePanelTab = 'log'"
          >
            日志
          </button>
          <button
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="sidePanelTab === 'config'
              ? 'bg-blue-600 text-white'
              : 'bg-(--app-card-soft) text-(--app-text-secondary) hover:text-(--app-text-primary)'"
            @click="sidePanelTab = 'config'"
          >
            节点配置
          </button>
          <button
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="sidePanelTab === 'canvasConfig'
              ? 'bg-blue-600 text-white'
              : 'bg-(--app-card-soft) text-(--app-text-secondary) hover:text-(--app-text-primary)'"
            @click="sidePanelTab = 'canvasConfig'"
          >
            画布配置
          </button>
          <button
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="sidePanelTab === 'motionController'
              ? 'bg-blue-600 text-white'
              : 'bg-(--app-card-soft) text-(--app-text-secondary) hover:text-(--app-text-primary)'"
            @click="sidePanelTab = 'motionController'"
          >
            运动控制
          </button>
        </div>

        <div class="h-[calc(100%-48px)] overflow-hidden">
          <FlowLogPanel v-if="sidePanelTab === 'log'" />
          <FlowNodeConfig v-else-if="sidePanelTab === 'config'" />
          <FlowCanvasConfig v-else-if="sidePanelTab === 'canvasConfig'" />
          <MotionController v-else-if="sidePanelTab === 'motionController'" />
        </div>
      </div>
    </aside>

  </div>
</template>
