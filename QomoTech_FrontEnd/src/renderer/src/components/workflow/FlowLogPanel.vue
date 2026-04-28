<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { LOG_LEVEL_COLOR, LOG_LEVEL_LABEL } from '../../configs/selfProcessConfigs'

const store = useSelfProcessStore()
const logContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const filterLevel = ref<string>('all')

const filteredLogs = computed(() => {
  if (filterLevel.value === 'all') return store.workflowLogs
  return store.workflowLogs.filter((log) => log.level === filterLevel.value)
})

// 自动滚动
watch(
  () => store.workflowLogs.length,
  async () => {
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
  <div class="log-panel">
    <div class="panel-header">
      <h3 class="panel-title">运行日志</h3>
      <div class="panel-actions">
        <button
          class="action-btn"
          :class="{ 'is-active': autoScroll }"
          @click="autoScroll = !autoScroll"
          title="自动滚动"
        >A</button>
        <button class="action-btn" @click="store.clearLogs()" title="清除日志">×</button>
      </div>
    </div>

    <!-- 级别筛选 -->
    <div class="filter-bar">
      <button
        v-for="level in (['all', 'info', 'warn', 'error', 'debug'] as const)"
        :key="level"
        class="filter-btn"
        :class="{ 'is-active': filterLevel === level }"
        :style="level !== 'all' ? { '--filter-color': LOG_LEVEL_COLOR[level] } : {}"
        @click="filterLevel = level"
      >
        {{ level === 'all' ? '全部' : LOG_LEVEL_LABEL[level] }}
      </button>
    </div>

    <!-- 日志列表 -->
    <div
      ref="logContainer"
      class="log-list"
      @scroll="onScroll"
    >
      <div v-if="filteredLogs.length === 0" class="log-empty">
        {{ store.isRunning ? '等待日志...' : '运行流程后将显示日志' }}
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="log-item"
        :style="{ '--log-color': LOG_LEVEL_COLOR[log.level] }"
      >
        <div class="log-line">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-level" :style="{ color: LOG_LEVEL_COLOR[log.level] }">
            [{{ LOG_LEVEL_LABEL[log.level] }}]
          </span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
        <div v-if="log.nodeId" class="log-node">节点: {{ log.nodeId.slice(0, 8) }}</div>
      </div>
    </div>

    <!-- 底部计数 -->
    <div class="panel-footer">
      <span class="footer-text">{{ filteredLogs.length }} 条日志</span>
      <span v-if="store.isRunning" class="footer-status running">● 运行中</span>
    </div>
  </div>
</template>

<style scoped>
.log-panel {
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
.panel-actions { display: flex; gap: 4px; }
.action-btn {
  width: 24px; height: 24px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.action-btn:hover { border-color: #2563eb; color: #2563eb; }
.action-btn.is-active { background: #2563eb; color: #fff; border-color: #2563eb; }

.filter-bar {
  display: flex;
  gap: 4px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--app-border);
}
.filter-btn {
  padding: 3px 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.1s;
}
.filter-btn:hover { border-color: var(--filter-color, #2563eb); color: var(--filter-color, #2563eb); }
.filter-btn.is-active {
  background: var(--filter-color, #2563eb);
  color: #fff;
  border-color: var(--filter-color, #2563eb);
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 14px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
}
.log-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--app-text-muted);
  font-family: sans-serif;
}

.log-item {
  padding: 3px 0;
  border-bottom: 1px solid var(--app-border);
}
.log-line { display: flex; gap: 6px; }
.log-time { color: var(--app-text-muted); white-space: nowrap; }
.log-level { font-weight: 600; white-space: nowrap; }
.log-msg { color: var(--app-text-primary); word-break: break-all; }
.log-node {
  font-size: 10px;
  color: var(--app-text-muted);
  padding-left: 80px;
}

.panel-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.footer-text { font-size: 11px; color: var(--app-text-muted); }
.footer-status { font-size: 11px; }
.footer-status.running { color: #2563eb; }
</style>
