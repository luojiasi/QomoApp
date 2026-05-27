// ─────────────────────────────────────────────────────────────
// composables/useWorkflowNode.ts — 节点卡片逻辑
// ─────────────────────────────────────────────────────────────

import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import { NODE_WIDTH } from '../constants/workflowCanvas'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'
import { NODE_STATUS_STYLES } from '../constants/nodeStatus'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { useCanvasSettings } from './useCanvasSettings'
import { executeFromNode } from '../nodes/executor/nodeExecutor'
import type { NodePort } from '../types/nodeDefinition'

export function useWorkflowNode(props: NodeProps) {
  const store = useWorkflowStore()
  const canvasSettings = useCanvasSettings()

  const nodeType = computed(() => (props.data?.nodeType as string) ?? props.type)

  const def = computed(() => NODE_REGISTRY[nodeType.value] ?? null)
  const category = computed(() => def.value?.category ?? 'motion')
  const style = computed(() => NODE_CATEGORY_STYLES[category.value])
  const label = computed(() => (props.data?.label as string) ?? props.id)
  const description = computed(() => (props.data?.description as string) ?? '')
  const displayName = computed(() => def.value?.displayName ?? nodeType.value)
  const icon = computed(() => def.value?.icon ?? style.value.fallbackIcon)
  const isTrigger = computed(() => category.value === 'trigger')

  const outputs = computed<NodePort[]>(() =>
    def.value?.outputs ?? [{ name: 'main', displayName: '完成' }]
  )
  const hasMultipleOutputs = computed(() => outputs.value.length > 1)

  // 输入端口 = 蓝图静态 inputs + 按 extraInputCount 动态生成的额外端口
  const extraInputCount = computed(() => {
    const n = Number(wfNode.value?.params?.extraInputCount)
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0
  })
  const allInputs = computed<NodePort[]>(() => {
    const base = def.value?.inputs ?? [{ name: 'main', displayName: '输入' }]
    const extras: NodePort[] = []
    for (let i = 1; i <= extraInputCount.value; i++) {
      extras.push({ name: `input_${i}`, displayName: `输入${i}` })
    }
    return [...base, ...extras]
  })
  const hasMultipleInputs = computed(() => allInputs.value.length > 1)
  const inputLabel = computed(() => def.value?.inputs[0]?.displayName ?? '输入')

  // 动态节点宽度：端口数越多卡片越宽
  const maxPorts = computed(() => Math.max(allInputs.value.length, outputs.value.length))
  const dynamicWidth = computed(() => 180 + Math.max(0, maxPorts.value - 2) * 68)

  // 从 store 读取当前节点的 disabled 状态
  const wfNode = computed(() =>
    store.currentWorkflow?.nodes.find((n) => n.id === props.id)
  )
  const disabled = computed(() => wfNode.value?.disabled ?? false)

  // ── 执行状态 ──────────────────────────────────────────────────
  const status = computed(() => wfNode.value?.status ?? 'editing')
  const statusStyle = computed(() => NODE_STATUS_STYLES[status.value])
  const statusIcon = computed(() => statusStyle.value.icon)
  const statusBorderColor = computed(() => statusStyle.value.borderColor)
  const statusAnimationClass = computed(() => statusStyle.value.animationClass)
  const isRunning = computed(() => status.value === 'running')
  const statusText = computed(() => wfNode.value?.statusText ?? null)

  function onRemove(): void {
    store.removeNode(props.id)
  }

  function onToggleDisable(): void {
    if (disabled.value) {
      store.enableNode(props.id)
    } else {
      store.disableNode(props.id)
    }
  }

  async function onRun(): Promise<void> {
    const wf = store.currentWorkflow
    if (!wf) return

    // 1. 重置所有节点为"未运行"
    store.resetAllNodeStatuses()
    store.addLog({ nodeId: props.id, nodeName: displayName.value, status: 'idle', message: '开始执行链路，所有节点状态已重置' })

    // 2. 执行（通过回调逐节点增量更新状态和日志）
    const result = await executeFromNode(wf, props.id, {
      onNodeStarted(nodeId: string) {
        store.setNodeStatus(nodeId, 'running')
      },
      onNodeCompleted(r) {
        store.setNodeStatus(r.nodeId, r.status)
        // 非主端口（如 IF 节点的 True/False）显示在卡片上
        store.setNodeStatusText(r.nodeId, r.targetPort && r.targetPort !== 'main' ? r.targetPort : null)
        const rName = wf.nodes.find(n => n.id === r.nodeId)?.label ?? r.nodeId
        let msg: string
        const detail = (r.output?.message as string) ?? r.error ?? ''
        if (r.status === 'success') {
          msg = `节点 "${rName}" 执行成功`
        } else if (r.status === 'failure') {
          msg = `节点 "${rName}" 执行失败${detail ? `：${detail}` : ''}`
        } else {
          msg = `节点 "${rName}" 执行完成${detail ? `（${detail}）` : ''}`
        }
        store.addLog({ nodeId: r.nodeId, nodeName: rName, status: r.status, message: msg })
      },
      onProgress(nodeId: string, text: string) {
        store.setNodeStatusText(nodeId, text)
        const name = wf.nodes.find(n => n.id === nodeId)?.label ?? nodeId
        store.addLog({ nodeId, nodeName: name, status: 'running', message: text })
      }
    })

    // 3. 全局失败（如节点不存在）
    if (!result.success) {
      store.setNodeStatus(props.id, 'failure')
      store.addLog({ nodeId: props.id, nodeName: displayName.value, status: 'failure', message: result.error ?? '执行失败' })
    }
  }

  return {
    NODE_WIDTH,
    dynamicWidth,
    def,
    category,
    style,
    label,
    description,
    displayName,
    icon,
    isTrigger,
    outputs,
    hasMultipleOutputs,
    allInputs,
    hasMultipleInputs,
    inputLabel,
    disabled,
    status,
    statusStyle,
    statusIcon,
    statusBorderColor,
    statusAnimationClass,
    isRunning,
    statusText,
    nodeBorderWidth: canvasSettings.nodeBorderWidth,
    onRemove,
    onToggleDisable,
    onRun
  }
}
