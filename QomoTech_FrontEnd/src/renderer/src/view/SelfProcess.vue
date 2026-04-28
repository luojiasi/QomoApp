<script setup lang="ts">
import { onMounted } from 'vue'
import { useSelfProcessStore } from '../stores/selfProcessStores'
import FlowTaskPanel from '../components/workflow/FlowTaskPanel.vue'
import FlowCanvas from '../components/workflow/FlowCanvas.vue'
import FlowNodeConfig from '../components/workflow/FlowNodeConfig.vue'
import FlowLogPanel from '../components/workflow/FlowLogPanel.vue'
import HomeOperationHelp_new from '../components/HomeOperationHelp_new.vue'

const store = useSelfProcessStore()

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
          class="cursor-pointer rounded-lg border border-green-500/30 bg-green-600 px-5 py-2 text-[13px] font-semibold text-white opacity-100 shadow-[0_8px_18px_rgba(22,163,74,0.18)] transition-all duration-100 enabled:hover:-translate-y-px enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          :disabled="!store.currentWorkflow || !store.currentWorkflow.firstNodeId"
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
        <div class="h-1/2 w-full shrink-0">
          <FlowCanvas class="h-full w-full" />
        </div>
        <div class="w-full shrink-0 overflow-hidden">
          <FlowNodeConfig />
        </div>
      </main>


    <aside class="h-full w-2/9 overflow-hidden">
      <FlowLogPanel />
    </aside>

  </div>
</template>
