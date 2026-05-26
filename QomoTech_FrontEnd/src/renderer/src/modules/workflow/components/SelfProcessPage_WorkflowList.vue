<script setup lang="ts">
// SelfProcessPage_WorkflowList.vue — 左侧流程列表面板
// 支持新建、切换、删除流程。
import { useWorkflowList } from '../composables/useWorkflowList'
import AppButton from '../UI/AppButton.vue'
import AppInput  from '../UI/AppInput.vue'

const {
  store,
  newName, showNewInput,
  startCreate, confirmCreate, cancelCreate,
  onInputKeydown, deleteWorkflow, formatDate
} = useWorkflowList()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card) shadow-[0_12px_32px_rgba(0,0,0,0.14)]">

    <!-- 顶部标题 + 新建按钮 -->
    <div class="flex items-center justify-between border-b border-(--app-border) px-4 py-3">
      <div>
        <h3 class="text-[15px] font-bold leading-tight text-(--app-text-primary)">流程列表</h3>
        <p class="mt-0.5 text-[11px] text-(--app-text-muted)">管理并切换</p>
      </div>
      <AppButton :disabled="store.isSaving" @click="startCreate">+ 新建</AppButton>
    </div>

    <!-- 新建流程输入框 -->
    <div v-if="showNewInput" class="flex flex-col gap-2 border-b border-(--app-border) bg-(--app-card-soft) px-4 py-3">
      <AppInput v-model="newName" placeholder="输入流程名称" autofocus @keydown="onInputKeydown" />
      <div class="flex gap-1.5">
        <AppButton size="sm" @click="confirmCreate">确定</AppButton>
        <AppButton variant="ghost" size="sm" @click="cancelCreate">取消</AppButton>
      </div>
    </div>

    <!-- 流程列表 -->
    <div class="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      <!-- 空状态 -->
      <div
        v-if="store.workflows.length === 0"
        class="rounded-xl border border-dashed border-(--app-border) px-4 py-10 text-center text-[13px] text-(--app-text-muted)"
      >
        <p class="font-semibold text-(--app-text-secondary)">暂无流程</p>
        <p class="mt-1 text-[11px]">点击「+ 新建」创建第一个流程</p>
      </div>

      <!-- 流程项 -->
      <div
        v-for="wf in store.workflows"
        :key="wf.id"
        class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-100 hover:bg-(--app-card-soft)"
        :class="wf.id === store.currentWorkflowId
          ? 'border-blue-500/40 bg-blue-600/10 shadow-[inset_3px_0_0_#2563eb]'
          : 'border-transparent'"
        @click="store.selectWorkflow(wf.id)"
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
          title="删除流程"
          @click.stop="deleteWorkflow(wf.id)"
        >×</button>
      </div>

    </div>

    <!-- 底部统计 -->
    <div class="border-t border-(--app-border) px-3.5 py-2">
      <span class="text-[11px] text-(--app-text-muted)">共 {{ store.workflows.length }} 个流程</span>
    </div>

  </div>
</template>
