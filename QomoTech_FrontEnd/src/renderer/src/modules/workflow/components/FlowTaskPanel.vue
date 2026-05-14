<script setup lang="ts">
import { ref } from 'vue'
import { useSelfProcessStore } from '../store/useSelfProcessStore'

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
  <div class="flex h-full flex-col overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card) shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
    <div class="flex items-center justify-between border-b border-(--app-border) px-4 py-3">
      <div>
        <h3 class="text-[15px] font-bold leading-tight text-(--app-text-primary)">流程列表</h3>
        <p class="mt-0.5 text-[11px] text-(--app-text-muted)">管理并切换自定义流程</p>
      </div>
      <button
        class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition-all duration-100 hover:-translate-y-px hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        @click="startNew"
        :disabled="store.isSaving"
      >
        + 新建
      </button>
    </div>

    <!-- 新建输入框 -->
    <div v-if="showNewInput" class="flex flex-col gap-2 border-b border-(--app-border) bg-(--app-card-soft) px-4 py-3">
      <input
        v-model="newName"
        class="rounded-md border border-blue-600 bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none"
        placeholder="输入流程名称"
        @keydown="onKeydown"
        ref="newInputRef"
        autofocus
      />
      <div class="flex gap-1.5">
        <button class="cursor-pointer rounded border-0 bg-blue-600 px-2.5 py-1 text-xs text-white" @click="confirmNew">
          确定
        </button>
        <button
          class="cursor-pointer rounded border-0 bg-(--app-card-soft) px-2.5 py-1 text-xs text-(--app-text-secondary)"
          @click="showNewInput = false"
        >
          取消
        </button>
      </div>
    </div>

    <!-- 流程列表 -->
    <div
      class="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div v-if="store.workflows.length === 0" class="rounded-xl border border-dashed border-(--app-border) px-4 py-10 text-center text-[13px] text-(--app-text-muted)">
        <p class="font-semibold text-(--app-text-secondary)">暂无流程</p>
        <p class="mt-1 text-[11px]">点击「+ 新建」创建第一个流程</p>
      </div>

      <div
        v-for="wf in store.workflows"
        :key="wf.id"
        class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-100 hover:bg-(--app-card-soft)"
        :class="wf.id === store.currentWorkflowId ? 'border-blue-500/40 bg-blue-600/10 shadow-[inset_3px_0_0_#2563eb]' : 'border-transparent'"
        @click="onSelect(wf.id)"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-(--app-text-primary)">
            {{ wf.name }}
          </span>
          <span class="text-[11px] text-(--app-text-muted)">
            {{ wf.nodes.length }} 个节点 · {{ formatDate(wf.updatedAt) }}
          </span>
        </div>
        <button
          class="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent text-base leading-none text-(--app-text-muted) hover:bg-red-600/10 hover:text-red-600"
          @click.stop="onDelete(wf.id)"
          title="删除流程"
        >×</button>
      </div>
    </div>

    <!-- 底部状态 -->
    <div class="border-t border-(--app-border) px-3.5 py-2">
      <span class="text-[11px] text-(--app-text-muted)">共 {{ store.workflows.length }} 个流程</span>
    </div>
  </div>
</template>
