// ─────────────────────────────────────────────────────────────
// composables/useWorkflowCanvas.ts — 画布交互逻辑（节点部分）
//
// 边的连线逻辑已独立到 useWorkflowEdge.ts。
// ─────────────────────────────────────────────────────────────

import { computed, markRaw, ref, onBeforeUnmount } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { Node } from '@vue-flow/core'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { useCanvasSettings } from './useCanvasSettings'
import { useWorkflowEdge } from './useWorkflowEdge'
import { NODE_WIDTH, NODE_HEIGHT, WORKFLOW_VUE_FLOW_ID } from '../constants/workflowCanvas'
import { registerCanvasKeydown } from '../infra/canvasKeyboardBridge'
import type { WorkflowNode } from '../types/workflow'
import WorkflowCanvasNode from '../components/WorkflowCanvas_Node.vue'
import WorkflowCanvasEdge from '../components/WorkflowCanvas_Edge.vue'

const nodeTypes = { 'workflow-node': markRaw(WorkflowCanvasNode) }

/** 覆盖 step / smoothstep / straight，修正水平布局时箭头朝向 */
const edgeTypes = {
  step: markRaw(WorkflowCanvasEdge),
  smoothstep: markRaw(WorkflowCanvasEdge),
  straight: markRaw(WorkflowCanvasEdge)
}

export function useWorkflowCanvas() {
  const store    = useWorkflowStore()
  const settings = useCanvasSettings()
  const edge     = useWorkflowEdge()
  const { onInit, screenToFlowCoordinate } = useVueFlow({ id: WORKFLOW_VUE_FLOW_ID })

  const showMenu    = ref(false)
  const menuPos     = ref({ x: 0, y: 0 })
  const menuFlowPos = ref<{ x: number; y: number } | null>(null)

  const defaultViewport = computed(() => ({
    x: settings.effective.value.defaultViewportX,
    y: settings.effective.value.defaultViewportY,
    zoom: settings.effective.value.defaultViewportZoom
  }))

  // ── 节点列表（VueFlow 格式） ─────────────────────────────────
  const vfNodes = computed<Node[]>({
    get: () => (store.currentWorkflow?.nodes ?? []).map(toVfNode),
    set: () => {}
  })

  function toVfNode(n: WorkflowNode): Node {
    return {
      id: n.id,
      type: 'workflow-node',
      position: n.position,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        nodeType: n.type,
        label: n.label,
        description: n.description
      }
    }
  }

  // ── 节点事件 ─────────────────────────────────────────────────

  function onNodeClick({ node }: { node: Node }): void {
    store.selectNode(node.id)
    edge.clearSelectedEdge()
  }

  function onPaneClick(): void {
    store.selectNode(null)
    edge.clearSelectedEdge()
    showMenu.value = false
  }

  function onNodeDragStop({ node }: { node: Node }): void {
    store.moveNode(node.id, node.position.x, node.position.y)
  }

  // ── 右键菜单 ─────────────────────────────────────────────────

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault()
    const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
    menuFlowPos.value = {
      x: flowPos.x - NODE_WIDTH / 2,
      y: flowPos.y - NODE_HEIGHT / 2
    }
    menuPos.value = { x: event.clientX, y: event.clientY }
    showMenu.value = true
  }

  function onMenuAdd(nodeType: string): void {
    store.addNode(nodeType, menuFlowPos.value?.x, menuFlowPos.value?.y)
    closeMenu()
  }

  function closeMenu(): void {
    showMenu.value = false
    menuFlowPos.value = null
  }

  // ── 键盘快捷键 ───────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Delete') {
      edge.deleteSelectedEdge()
    }
  }

  let unregisterKeydown: (() => void) | null = null

  onInit(() => {
    unregisterKeydown = registerCanvasKeydown(onKeydown)
  })

  onBeforeUnmount(() => {
    unregisterKeydown?.()
    unregisterKeydown = null
  })

  return {
    nodeTypes,
    edgeTypes,
    vfNodes,
    vfEdges: edge.vfEdges,
    settings,
    defaultViewport,
    showMenu,
    menuPos,
    // 边事件（来自 useWorkflowEdge）
    onConnect: edge.onConnect,
    onEdgeClick: edge.onEdgeClick,
    // 节点事件
    onNodeClick,
    onPaneClick,
    onNodeDragStop,
    // 菜单
    onContextMenu,
    onMenuAdd,
    closeMenu
  }
}
