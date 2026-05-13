<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSelfProcessStore } from './useSelfProcessStore'
import { LOG_LEVEL_COLOR, LOG_LEVEL_LABEL } from './selfProcessConfig'

const store = useSelfProcessStore()
const logContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const filterLevel = ref<string>('all')
const expandedLogIds = ref<Set<string>>(new Set())

const filteredLogs = computed(() => {
  if (filterLevel.value === 'all') return store.workflowLogs
  return store.workflowLogs.filter((log) => log.level === filterLevel.value)
})

function toggleExpand(logId: string): void {
  const next = new Set(expandedLogIds.value)
  if (next.has(logId)) {
    next.delete(logId)
  } else {
    next.add(logId)
  }
  expandedLogIds.value = next
}

function isExpanded(logId: string): boolean {
  return expandedLogIds.value.has(logId)
}

function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// 自动滚动 & 日志清空时重置展开状态
watch(
  () => store.workflowLogs.length,
  async (len) => {
    if (len === 0) expandedLogIds.value = new Set()
    if (autoScroll.value) {
      await nextTick()
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    }
  }
)

function onScroll(): void {
  if (!logContainer.value) return
  const el = logContainer.value
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return timestamp
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card) shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
    <div class="flex items-center justify-between border-b border-(--app-border) px-4 py-3">
      <div>
        <h3 class="text-[15px] font-bold leading-tight text-(--app-text-primary)">运行日志</h3>
        <p class="mt-0.5 text-[11px] text-(--app-text-muted)">查看执行状态和节点输出</p>
      </div>
      <div class="flex gap-1">
        <button
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs font-bold hover:border-blue-600 hover:text-blue-600"
          :class="autoScroll ? 'border-blue-600 bg-blue-600 text-white' : 'border-(--app-border) bg-transparent text-(--app-text-muted)'"
          @click="autoScroll = !autoScroll"
          title="自动滚动"
        >A</button>
        <button
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-(--app-border) bg-transparent text-xs font-bold text-(--app-text-muted) hover:border-blue-600 hover:text-blue-600"
          @click="store.clearLogs()"
          title="清除日志"
        >×</button>
      </div>
    </div>

    <!-- 级别筛选 -->
    <div class="flex gap-1 border-b border-(--app-border) bg-(--app-card-soft) px-3.5 py-2">
      <button
        v-for="level in (['all', 'info', 'warn', 'error', 'debug'] as const)"
        :key="level"
        class="cursor-pointer rounded border px-2 py-[3px] text-[11px] transition-all duration-100"
        :class="filterLevel === level ? 'text-white' : 'bg-transparent text-(--app-text-muted)'"
        :style="{
          borderColor: filterLevel === level ? (level === 'all' ? '#2563eb' : LOG_LEVEL_COLOR[level]) : 'var(--app-border)',
          background: filterLevel === level ? (level === 'all' ? '#2563eb' : LOG_LEVEL_COLOR[level]) : 'transparent'
        }"
        @click="filterLevel = level"
      >
        {{ level === 'all' ? '全部' : LOG_LEVEL_LABEL[level] }}
      </button>
    </div>

    <!-- 日志列表 -->
    <div
      ref="logContainer"
      class="flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[11px] leading-normal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      @scroll="onScroll"
    >
      <div
        v-if="filteredLogs.length === 0"
        class="mx-1 mt-2 rounded-xl border border-dashed border-(--app-border) px-4 py-10 text-center font-sans text-(--app-text-muted)"
      >
        <p class="text-[13px] font-semibold text-(--app-text-secondary)">
          运行流程后将显示日志
        </p>
        <p class="mt-1 text-[11px]">日志会按时间自动追加到这里</p>
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="mb-0.5 cursor-pointer rounded-lg border px-2 py-1 transition-colors duration-100 hover:bg-(--app-card-soft)"
        :style="{ borderColor: log.data ? LOG_LEVEL_COLOR[log.level] + '30' : 'transparent', borderLeftWidth: '3px' }"
        :class="{ 'bg-(--app-card-soft)': isExpanded(log.id) }"
        @click="log.data ? toggleExpand(log.id) : undefined"
      >
        <div class="flex items-center gap-1.5">
          <span
            v-if="log.data"
            class="inline-block text-[10px] leading-none transition-transform duration-150"
            :class="{ 'rotate-90': isExpanded(log.id) }"
          >▶</span>
          <span
            v-else
            class="inline-block w-[10px]"
          />
          <span class="whitespace-nowrap text-(--app-text-muted)">{{ formatTime(log.timestamp) }}</span>
          <span class="whitespace-nowrap font-semibold" :style="{ color: LOG_LEVEL_COLOR[log.level] }">
            [{{ LOG_LEVEL_LABEL[log.level] }}]
          </span>
          <span class="flex-1 break-all text-(--app-text-primary)">{{ log.message }}</span>
        </div>
        <div v-if="log.nodeId" class="pl-16 text-[10px] text-(--app-text-muted)">
          节点: {{ log.nodeId.slice(0, 8) }}
        </div>
        <!-- 展开的 JSON 数据 -->
        <div
          v-if="log.data && isExpanded(log.id)"
          class="mt-1 overflow-x-auto rounded bg-black/5 px-2.5 py-1.5 font-mono text-[10px] leading-snug whitespace-pre text-(--app-text-secondary) dark:bg-white/5"
        >{{ formatJson(log.data) }}</div>
      </div>
    </div>

    <!-- 底部计数 -->
    <div class="flex items-center justify-between border-t border-(--app-border) px-3.5 py-2">
      <span class="text-[11px] text-(--app-text-muted)">{{ filteredLogs.length }} 条日志</span>
    </div>
  </div>
</template>
