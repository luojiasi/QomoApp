<script setup lang="ts">
// SelfProcessPage_LogPanel.vue — 执行日志面板
import { watch, ref, nextTick } from 'vue'
import { useWorkflowLog } from '../composables/useWorkflowLog'
import { NODE_STATUS_STYLES } from '../constants/nodeStatus'
import AppButton from '../UI/AppButton.vue'
import type { NodeExecutionStatus } from '../types/workflow'

const { logs, hasLogs, clear } = useWorkflowLog()

const listEl = ref<HTMLElement | null>(null)

// 新日志到达时自动滚动到底部
watch(
  () => logs.value.length,
  async () => {
    await nextTick()
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight
    }
  }
)

function statusLabel(s: NodeExecutionStatus): string {
  const map: Record<NodeExecutionStatus, string> = {
    editing: '',
    idle: '未运行',
    running: '运行中',
    success: '成功',
    failure: '失败',
    warning: '警告'
  }
  return map[s] ?? ''
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- 顶栏：标题 + 清空 -->
    <div class="flex shrink-0 items-center justify-between border-b border-(--app-border) px-3 py-2">
      <span class="text-[12px] font-semibold text-(--app-text-primary)">
        执行日志
        <span class="ml-1 font-normal text-(--app-text-muted)">({{ logs.length }})</span>
      </span>
      <AppButton
        variant="ghost"
        :disabled="!hasLogs"
        class="px-2! py-1! text-[11px]"
        @click="clear"
      >清空</AppButton>
    </div>

    <!-- 日志列表 -->
    <div
      ref="listEl"
      class="wf-scroll-y flex min-h-0 flex-1 flex-col gap-0.5 p-2"
    >
      <template v-if="hasLogs">
        <div
          v-for="log in logs"
          :key="log.id"
          class="flex items-start gap-2 rounded-md px-2.5 py-1.5 transition-colors hover:bg-(--app-card-soft)"
        >
          <!-- 状态图标 -->
          <span
            class="mt-0.5 shrink-0 text-[11px] font-bold leading-none"
            :style="{ color: NODE_STATUS_STYLES[log.status].borderColor }"
          >{{ NODE_STATUS_STYLES[log.status].icon || '·' }}</span>

          <!-- 日志内容 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                v-if="log.nodeName"
                class="truncate text-[11px] font-medium text-(--app-text-primary)"
              >{{ log.nodeName }}</span>
              <span class="shrink-0 text-[10px] text-(--app-text-muted)">
                {{ new Date(log.timestamp).toLocaleTimeString() }}
              </span>
              <span
                class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                :style="{
                  color: NODE_STATUS_STYLES[log.status].borderColor,
                  background: NODE_STATUS_STYLES[log.status].borderColor + '18'
                }"
              >{{ statusLabel(log.status) }}</span>
            </div>
            <div class="mt-0.5 text-[11px] leading-relaxed text-(--app-text-secondary)">
              {{ log.message }}
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex flex-1 flex-col items-center justify-center gap-1 text-(--app-text-muted)">
        <span class="text-lg">⊡</span>
        <span class="text-[11px]">暂无日志，运行节点后显示</span>
      </div>
    </div>

  </div>
</template>
