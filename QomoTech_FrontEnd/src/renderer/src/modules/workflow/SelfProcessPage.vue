<script setup lang="ts">
// SelfProcessPage.vue — 自定流程页面入口
//
// 只负责三栏布局的组装，所有逻辑都在各自的组件和 composables 里。
// 如果需要添加新功能，找对应的组件文件修改，不要在这里堆代码。
//
// 布局：
//   左侧  WorkflowList    — 流程列表（新建 / 切换 / 删除）
//   中间  WorkflowCanvas  — VueFlow 画布（拖拽节点、连线）
//   右侧  CameraPic       — 相机画面
//         Tab 切换        — 节点配置 / 画布配置
import { ref } from 'vue'
import { useWorkflowPage } from './composables/useWorkflowPage'
import WorkflowList   from './components/SelfProcessPage_WorkflowList.vue'
import WorkflowCanvas from './components/SelfProcessPage_WorkflowCanvas.vue'
import CanvasSettings from './components/SelfProcessPage_CanvasSettings.vue'
import NodeSettings   from './components/SelfProcessPage_NodeSettings.vue'
import LogPanel       from './components/SelfProcessPage_LogPanel.vue'
import CameraPic      from '@/modules/camera/CameraPic.vue'
import AppButton      from './UI/AppButton.vue'
import AppTabs        from './UI/AppTabs.vue'
import './workflow.css'

const { store, startWorkflow } = useWorkflowPage()

const settingsTab = ref<'node' | 'canvas' | 'log'>('node')

const settingsTabs = [
  { key: 'node',   label: '节点配置' },
  { key: 'canvas', label: '画布配置' },
  { key: 'log',    label: '日志' }
]
</script>

<template>
  <!-- 顶栏 -->
  <div class="flex shrink-0 items-center gap-4 rounded-2xl border border-(--app-border) bg-(--app-card) px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
    <div class="flex min-w-[220px] flex-col gap-0.5">
      <h1 class="text-lg font-bold leading-tight text-(--app-text-primary)">自定流程</h1>
      <span class="text-xs text-(--app-text-muted)">
        {{ store.currentWorkflow ? store.currentWorkflow.name : '创建流程后开始编排节点' }}
      </span>
    </div>

    <div class="flex flex-1 justify-center gap-2">
      <AppButton
        variant="success"
        :disabled="!store.currentWorkflow"
        @click="startWorkflow()"
      >
        开始流程
      </AppButton>
      <AppButton
        :disabled="!store.currentWorkflow || store.isSaving"
        @click="store.save()"
      >
        {{ store.isSaving ? '保存中...' : '保存流程' }}
      </AppButton>
      <AppButton
        variant="danger"
        :disabled="!store.currentWorkflow"
        @click="store.stopAll()"
      >
        终止流程
      </AppButton>
    </div>

    <div class="flex items-center">
      <RouterLink
        to="/home"
        class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-25 py-2 text-[13px] text-(--app-text-muted) no-underline transition-colors hover:text-(--app-text-primary)"
      >
        返回首页
      </RouterLink>
    </div>
  </div>

  <!-- 三栏主体 -->
  <div class="wf-scroll-y absolute top-1/16 bottom-4 z-20 flex min-h-0 w-full gap-3 p-3">

    <!-- 左侧：流程列表 -->
    <aside class="h-full w-1/8 overflow-hidden">
      <WorkflowList />
    </aside>

    <!-- 中间：画布 -->
    <main class="h-full w-3/4 overflow-hidden">
      <WorkflowCanvas class="h-full w-full" />
    </main>

    <!-- 右侧：相机 + 画布配置 -->
    <aside class="flex h-full w-2/9 flex-col overflow-hidden gap-3">
      <div class="h-2/5 overflow-hidden rounded-xl border border-(--app-border)">
        <CameraPic object-fit="cover" />
      </div>
      <div class="h-3/5 overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card)">
        <AppTabs v-model="settingsTab" :tabs="settingsTabs" />
        <div class="min-h-0 h-[calc(100%-40px)] overflow-hidden">
          <NodeSettings   v-if="settingsTab === 'node'" />
          <CanvasSettings v-else-if="settingsTab === 'canvas'" />
          <LogPanel       v-else />
        </div>
      </div>
    </aside>

  </div>
</template>
