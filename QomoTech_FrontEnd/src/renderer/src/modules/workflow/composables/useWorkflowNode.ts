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
  const inputLabel = computed(() => def.value?.inputs[0]?.displayName ?? '输入')

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

  function onRun(): void {
    const wf = store.currentWorkflow
    if (!wf) return

    // 1. 重置所有节点为"未运行"
    store.resetAllNodeStatuses()

    // 2. 标记当前节点为"运行中"
    store.setNodeStatus(props.id, 'running')

    // 3. 执行
    const result = executeFromNode(wf, props.id)

    // 4. 根据结果更新节点状态
    if (result.success) {
      for (const r of result.results) {
        store.setNodeStatus(r.nodeId, r.status)
      }
    } else {
      store.setNodeStatus(props.id, 'failure')
      console.warn('[WorkflowNode] 运行失败:', result.error)
    }
  }

  return {
    NODE_WIDTH,
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
    inputLabel,
    disabled,
    status,
    statusStyle,
    statusIcon,
    statusBorderColor,
    statusAnimationClass,
    isRunning,
    nodeBorderWidth: canvasSettings.nodeBorderWidth,
    onRemove,
    onToggleDisable,
    onRun
  }
}
