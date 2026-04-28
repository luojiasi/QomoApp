<script setup lang="ts">
import { ref } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'

const store = useSelfProcessStore()
const newName = ref('')
const showNewInput = ref(false)

function startNew(): void {
  showNewInput.value = true
  newName.value = ''
}

function confirmNew(): void {
  const name = newName.value.trim()
  if (!name) {
    showNewInput.value = false
    return
  }
  store.createWorkflow(name)
  store.saveWorkflow()
  showNewInput.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') confirmNew()
  if (e.key === 'Escape') showNewInput.value = false
}

function onSelect(id: string): void {
  store.selectWorkflow(id)
}

async function onDelete(id: string): Promise<void> {
  await store.deleteWorkflow(id)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="task-panel">
    <div class="panel-header">
      <h3 class="panel-title">流程列表</h3>
      <button class="panel-add-btn" @click="startNew" :disabled="store.isSaving">
        + 新建
      </button>
    </div>

    <!-- 新建输入框 -->
    <div v-if="showNewInput" class="new-input-area">
      <input
        v-model="newName"
        class="new-input"
        placeholder="输入流程名称"
        @keydown="onKeydown"
        ref="newInputRef"
        autofocus
      />
      <div class="new-actions">
        <button class="new-confirm" @click="confirmNew">确定</button>
        <button class="new-cancel" @click="showNewInput = false">取消</button>
      </div>
    </div>

    <!-- 流程列表 -->
    <div class="workflow-list">
      <div v-if="store.workflows.length === 0" class="list-empty">
        <p>暂无流程</p>
        <p class="list-empty-hint">点击「+ 新建」创建第一个流程</p>
      </div>

      <div
        v-for="wf in store.workflows"
        :key="wf.id"
        class="workflow-item"
        :class="{ 'is-active': wf.id === store.currentWorkflowId }"
        @click="onSelect(wf.id)"
      >
        <div class="workflow-info">
          <span class="workflow-name">{{ wf.name }}</span>
          <span class="workflow-meta">
            {{ wf.nodes.length }} 个节点 · {{ formatDate(wf.updatedAt) }}
          </span>
        </div>
        <button
          class="workflow-delete"
          @click.stop="onDelete(wf.id)"
          title="删除流程"
        >×</button>
      </div>
    </div>

    <!-- 底部状态 -->
    <div class="panel-footer">
      <span class="footer-text">共 {{ store.workflows.length }} 个流程</span>
    </div>
  </div>
</template>

<style scoped>
.task-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  overflow: hidden;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--app-border);
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text-primary);
}
.panel-add-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s;
}
.panel-add-btn:hover { background: #1d4ed8; }
.panel-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.new-input-area {
  padding: 10px 14px;
  border-bottom: 1px solid var(--app-border);
  display: flex; flex-direction: column; gap: 6px;
}
.new-input {
  padding: 6px 10px;
  border: 1px solid #2563eb;
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 13px;
  outline: none;
}
.new-actions { display: flex; gap: 6px; }
.new-confirm, .new-cancel {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.new-confirm { background: #2563eb; color: #fff; }
.new-cancel { background: var(--app-card-soft); color: var(--app-text-secondary); }

.workflow-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.list-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--app-text-muted);
}
.list-empty-hint { font-size: 11px; margin-top: 4px; }

.workflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.workflow-item:hover { background: var(--app-card-soft); }
.workflow-item.is-active {
  background: rgba(37,99,235,0.08);
  border: 1px solid rgba(37,99,235,0.2);
}
.workflow-info {
  flex: 1;
  min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.workflow-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.workflow-meta {
  font-size: 11px;
  color: var(--app-text-muted);
}
.workflow-delete {
  width: 20px; height: 20px;
  border: none; background: transparent;
  color: var(--app-text-muted);
  font-size: 16px; line-height: 1;
  cursor: pointer; border-radius: 4px;
  flex-shrink: 0;
}
.workflow-delete:hover { color: #dc2626; background: rgba(220,38,38,0.1); }

.panel-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--app-border);
}
.footer-text {
  font-size: 11px;
  color: var(--app-text-muted);
}
</style>
