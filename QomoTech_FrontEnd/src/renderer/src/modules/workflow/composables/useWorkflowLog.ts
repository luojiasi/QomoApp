// ─────────────────────────────────────────────────────────────
// composables/useWorkflowLog.ts — 执行日志
// ─────────────────────────────────────────────────────────────

import { computed } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'

export function useWorkflowLog() {
  const store = useWorkflowStore()

  const logs = computed(() => store.logs)

  const hasLogs = computed(() => logs.value.length > 0)

  function clear(): void {
    store.clearLogs()
  }

  return { logs, hasLogs, clear }
}
