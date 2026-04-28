import { ref } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import type { WorkflowLog } from '../../types/selfProcessTypes'

/**
 * FlowRunner 组合式函数
 * 提供流程运行相关的状态和方法，补充 store 中的运行逻辑
 */
export function useFlowRunner() {
  const store = useSelfProcessStore()
  const executionProgress = ref(0)
  const currentNodeLabel = ref('')

  /** 获取运行进度百分比 */
  function updateProgress(): void {
    const wf = store.currentWorkflow
    if (!wf || wf.nodes.length === 0) {
      executionProgress.value = 0
      return
    }
    const completed = wf.nodes.filter(
      (n) => n.runStatus === 'success' || n.runStatus === 'failed' || n.runStatus === 'skipped'
    ).length
    executionProgress.value = Math.round((completed / wf.nodes.length) * 100)

    const running = wf.nodes.find((n) => n.runStatus === 'running')
    currentNodeLabel.value = running?.label ?? ''
  }

  /** 获取最新的错误日志 */
  function getLastError(): WorkflowLog | undefined {
    return [...store.workflowLogs].reverse().find((l) => l.level === 'error')
  }

  /** 检查流程是否可以运行 */
  function canRun(): boolean {
    const wf = store.currentWorkflow
    if (!wf) return false
    if (!wf.firstNodeId) return false
    if (store.isRunning) return false
    return wf.nodes.length > 0
  }

  return {
    executionProgress,
    currentNodeLabel,
    updateProgress,
    getLastError,
    canRun
  }
}
