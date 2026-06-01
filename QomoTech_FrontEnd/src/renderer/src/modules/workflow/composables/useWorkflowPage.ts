// ─────────────────────────────────────────────────────────────
// composables/useWorkflowPage.ts
//
// SelfProcessPage.vue 的逻辑层。
// 职责：页面挂载初始化 + 全局流程执行控制。
// ─────────────────────────────────────────────────────────────

import { onMounted } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { executeWorkflow } from '../nodes/executor/nodeExecutor'
import { notifyByType } from '@/shared/composables/useNotification'

export function useWorkflowPage() {
  const store = useWorkflowStore()

  onMounted(async () => {
    await store.init()
  })

  /** 全局"开始流程"：从所有 trigger 节点出发执行整条链路 */
  async function startWorkflow(): Promise<void> {
    const wf = store.currentWorkflow
    if (!wf) return

    store.resetAllNodeStatuses()
    store.clearLogs()
    store.clearNodeOutputs()
    store.addLog({ nodeId: '', nodeName: '全局触发', status: 'idle', message: '开始执行流程，所有节点状态已重置' })

    const controller = store.getOrCreateAbortController()
    const result = await executeWorkflow(wf, {
      onNodeStarted(nodeId: string) {
        store.setNodeStatus(nodeId, 'running')
      },
      onNodeCompleted(r) {
        store.setNodeOutput(r.nodeId, r.output as Record<string, unknown>)
        store.setNodeStatus(r.nodeId, r.status)
        store.setNodeStatusText(r.nodeId, r.targetPort && r.targetPort !== 'main' ? r.targetPort : null)
        const rName = wf.nodes.find(n => n.id === r.nodeId)?.label ?? r.nodeId
        let msg: string
        if (r.status === 'success') {
          const detail = (r.output?.message as string) ?? r.error ?? ''
          msg = `节点 "${rName}" 执行成功${detail ? `：${detail}` : ''}`
        } else if (r.status === 'failure') {
          const detail = r.error ?? (r.output?.message as string) ?? ''
          msg = `节点 "${rName}" 执行失败${detail ? `：${detail}` : ''}`
        } else {
          const detail = (r.output?.message as string) ?? r.error ?? ''
          msg = `节点 "${rName}" 执行完成${detail ? `（${detail}）` : ''}`
        }
        store.addLog({ nodeId: r.nodeId, nodeName: rName, status: r.status, message: msg })
      },
      onProgress(nodeId: string, text: string) {
        store.setNodeStatusText(nodeId, text)
        const name = wf.nodes.find(n => n.id === nodeId)?.label ?? nodeId
        store.addLog({ nodeId, nodeName: name, status: 'running', message: text })
      }
    }, controller.signal)

    if (!result.success) {
      store.addLog({ nodeId: '', nodeName: '全局触发', status: 'failure', message: result.error ?? '执行失败' })
      notifyByType('error', '开始流程失败', result.error ?? '未知错误')
    } else {
      notifyByType('success', '开始流程', '流程已成功启动，正在执行中')
    }
  }

  return { store, startWorkflow }
}
