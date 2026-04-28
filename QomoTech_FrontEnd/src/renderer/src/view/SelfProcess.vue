<script setup lang="ts">
import { onMounted } from 'vue'
import { useSelfProcessStore } from '../stores/selfProcessStores'
import FlowTaskPanel from '../components/workflow/FlowTaskPanel.vue'
import FlowCanvas from '../components/workflow/FlowCanvas.vue'
import FlowNodeConfig from '../components/workflow/FlowNodeConfig.vue'
import FlowLogPanel from '../components/workflow/FlowLogPanel.vue'

const store = useSelfProcessStore()

onMounted(async () => {
  await store.init()
})
</script>

<template>
  <div class="app-page sp-page">
    <!-- 顶部工具栏 -->
    <div class="sp-toolbar">
      <div class="toolbar-left">
        <h1 class="toolbar-title">自定流程</h1>
        <span v-if="store.currentWorkflow" class="toolbar-subtitle">
          {{ store.currentWorkflow.name }}
        </span>
      </div>
      <div class="toolbar-center">
        <button
          class="tb-btn tb-primary"
          :disabled="!store.currentWorkflow || store.isSaving"
          @click="store.saveWorkflow()"
        >
          {{ store.isSaving ? '保存中...' : '保存流程' }}
        </button>
        <button
          v-if="!store.isRunning"
          class="tb-btn tb-success"
          :disabled="!store.currentWorkflow || !store.currentWorkflow.firstNodeId"
          @click="store.runWorkflow()"
        >
          运行
        </button>
        <button
          v-else
          class="tb-btn tb-danger"
          @click="store.stopWorkflow()"
        >
          停止
        </button>
      </div>
      <div class="toolbar-right">
        <RouterLink to="/home" class="tb-link">返回首页</RouterLink>
      </div>
    </div>

    <!-- 三栏主体 -->
    <div class="sp-body">
      <!-- 左侧：任务区 -->
      <aside class="sp-left">
        <FlowTaskPanel />
      </aside>

      <!-- 中间：操作区 -->
      <main class="sp-center">
        <FlowCanvas />
        <div class="sp-config-area">
          <FlowNodeConfig />
        </div>
      </main>

      <!-- 右侧：日志区 -->
      <aside class="sp-right">
        <FlowLogPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.sp-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ──── 顶部工具栏 ──── */
.sp-toolbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 16px;
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}
.toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary);
}
.toolbar-subtitle {
  font-size: 13px;
  color: var(--app-text-muted);
}
.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.toolbar-right {
  display: flex;
  align-items: center;
}

.tb-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.1s;
}
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-primary { background: #2563eb; color: #fff; }
.tb-primary:hover:not(:disabled) { background: #1d4ed8; }
.tb-success { background: #16a34a; color: #fff; }
.tb-success:hover:not(:disabled) { background: #15803d; }
.tb-danger { background: #dc2626; color: #fff; }
.tb-danger:hover:not(:disabled) { background: #b91c1c; }

.tb-link {
  font-size: 13px;
  color: var(--app-text-muted);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background 0.1s;
}
.tb-link:hover {
  background: var(--app-card-soft);
  color: var(--app-text-primary);
}

/* ──── 三栏主体 ──── */
.sp-body {
  flex: 1;
  display: flex;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
}

.sp-left {
  width: 280px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
}

.sp-center {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.sp-config-area {
  flex-shrink: 0;
  max-height: 300px;
  overflow-y: auto;
}

.sp-right {
  width: 320px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
}
</style>
