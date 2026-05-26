// ─────────────────────────────────────────────────────────────
// composables/useWorkflowNode.ts — 节点卡片逻辑
// ─────────────────────────────────────────────────────────────

import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import { NODE_WIDTH } from '../constants/workflowCanvas'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import type { NodePort } from '../types/nodeDefinition'

export function useWorkflowNode(
  props: NodeProps,
  emit: (event: 'remove', id: string) => void
) {
  // 业务节点类型存在 data.nodeType（VueFlow 的 type 固定为 workflow-node）
  const nodeType = computed(() => (props.data?.nodeType as string) ?? props.type)

  const def = computed(() => NODE_REGISTRY[nodeType.value] ?? null)

  // 节点分类（无蓝图时降级为 'motion'）
  const category = computed(() => def.value?.category ?? 'motion')

  // 该分类对应的视觉样式
  const style = computed(() => NODE_CATEGORY_STYLES[category.value])

  // 用户自定义名称（来自 store.WorkflowNode.label）
  const label = computed(() => (props.data?.label as string) ?? props.id)

  // 节点备注
  const description = computed(() => (props.data?.description as string) ?? '')

  // 节点头部显示名（来自蓝图 displayName，未注册时显示 type）
  const displayName = computed(() => def.value?.displayName ?? nodeType.value)

  // 图标（蓝图有 icon 则用，否则用分类备用图标）
  const icon = computed(() => def.value?.icon ?? style.value.fallbackIcon)

  // 是否为触发器（触发器没有输入端口）
  const isTrigger = computed(() => category.value === 'trigger')

  // 输出端口列表（无蓝图时默认单输出 main）
  const outputs = computed<NodePort[]>(() =>
    def.value?.outputs ?? [{ name: 'main', displayName: '完成' }]
  )

  // 是否有多个输出端口
  const hasMultipleOutputs = computed(() => outputs.value.length > 1)

  // 计算多输出端口的水平偏移，使各端口均匀分布
  function handleOffset(total: number, idx: number): string {
    if (total <= 1) return ''
    const span = Math.min(80, total * 28)
    const step = span / (total - 1)
    return `${-span / 2 + idx * step}px`
  }

  function onRemove(): void {
    emit('remove', props.id)
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
    handleOffset,
    onRemove
  }
}
