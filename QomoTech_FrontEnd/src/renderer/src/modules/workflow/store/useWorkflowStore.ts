// ─────────────────────────────────────────────────────────────
// store/useWorkflowStore.ts
//
// 流程数据的全局状态管理（Pinia）。
//
// 职责：
//   - 持有所有流程和当前选中状态
//   - 提供流程/节点/边的 CRUD 操作
//   - 通过 window.api（Electron preload）读写本地 JSON 文件
//
// 不负责：
//   - 节点执行（由未来的 engine 层负责）
//   - 画布视觉配置（由 useCanvasSettings 负责）
// ─────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowIndexEntry, NodeExecutionStatus } from '../types/workflow'
import type { LogEntry } from '../types/workflowLog'
import { getWorkflowApi } from '../infra/workflowApiBridge'
import {
  generateId,
  createWorkflow,
  createNode,
  workflowDirPath,
  workflowFilePath,
  indexFilePath,
  nowISO
} from '../utils/workflowUtils'

// ─── Store ────────────────────────────────────────────────────

export const useWorkflowStore = defineStore('workflow', () => {

  // ── 状态 ────────────────────────────────────────────────────
  const workflows        = ref<Workflow[]>([])
  const currentWorkflowId = ref<string | null>(null)
  const selectedNodeId   = ref<string | null>(null)
  const isSaving         = ref(false)
  const basePath         = ref('')   // 由 Electron 提供的流程目录
  const logs             = ref<LogEntry[]>([])

  // ── 派生状态 ─────────────────────────────────────────────────
  const currentWorkflow = computed(() =>
    workflows.value.find(w => w.id === currentWorkflowId.value) ?? null
  )

  const selectedNode = computed(() => {
    if (!currentWorkflow.value || !selectedNodeId.value) return null
    return currentWorkflow.value.nodes.find(n => n.id === selectedNodeId.value) ?? null
  })

  // index.json 只需要轻量数据，不含节点列表
  const indexEntries = computed((): WorkflowIndexEntry[] =>
    workflows.value.map(w => ({ id: w.id, name: w.name, updatedAt: w.updatedAt }))
  )

  // ── 初始化 ───────────────────────────────────────────────────

  /** 页面挂载时调用，读取本地流程文件 */
  async function init(): Promise<void> {
    const api = getWorkflowApi()
    if (!api) return
    try {
      basePath.value = await api.getWorkflowsPath()
      await loadAll()
    } catch (e) {
      console.error('[WorkflowStore] 初始化失败:', e)
    }
  }

  // ── 文件 I/O ─────────────────────────────────────────────────

  async function loadAll(): Promise<void> {
    const api = getWorkflowApi()
    if (!api || !basePath.value) return

    const indexRes = await api.readFile(indexFilePath(basePath.value))
    if (!indexRes.ok || !indexRes.data) {
      workflows.value = []
      currentWorkflowId.value = null
      return
    }

    try {
      const entries = JSON.parse(indexRes.data) as WorkflowIndexEntry[]
      const loaded: Workflow[] = []

      for (const entry of entries) {
        const res = await api.readFile(workflowFilePath(basePath.value, entry.id))
        if (!res.ok || !res.data) continue

        const wf = JSON.parse(res.data) as Workflow
        loaded.push(wf)
      }

      workflows.value = loaded
      currentWorkflowId.value = loaded[0]?.id ?? null
    } catch (e) {
      workflows.value = []
      currentWorkflowId.value = null
      console.error('[WorkflowStore] 读取流程文件失败:', e)
    }
  }

  /** 保存当前流程（或指定 id 的流程）到磁盘 */
  async function save(workflowId?: string): Promise<boolean> {
    const api = getWorkflowApi()
    const wf = workflowId
      ? workflows.value.find(w => w.id === workflowId)
      : currentWorkflow.value
    if (!wf || !basePath.value || !api) return false

    isSaving.value = true
    try {
      // 先序列化再更新时间戳，避免中途 reactive 突变触发画布重渲染
      const updatedAt = nowISO()
      const data = { ...wf, updatedAt }
      const r1 = await api.writeFile(workflowFilePath(basePath.value, wf.id), JSON.stringify(data, null, 2))
      if (!r1.ok) return false
      const idxData = indexEntries.value.map(e => e.id === wf.id ? { ...e, updatedAt } : e)
      const r2 = await api.writeFile(indexFilePath(basePath.value), JSON.stringify(idxData, null, 2))
      if (!r2.ok) return false
      // 写盘成功后才更新 reactive 状态（此时触发的重渲染无副作用）
      wf.updatedAt = updatedAt
      return true
    } catch {
      return false
    } finally {
      isSaving.value = false
    }
  }

  // ── 流程 CRUD ─────────────────────────────────────────────────

  function addWorkflow(name: string): Workflow {
    const wf = createWorkflow(name)
    workflows.value.push(wf)
    currentWorkflowId.value = wf.id
    selectedNodeId.value = null
    return wf
  }

  async function removeWorkflow(id: string): Promise<boolean> {
    const api = getWorkflowApi()
    if (!api || !basePath.value) return false
    const wf = workflows.value.find(w => w.id === id)
    if (!wf) return false

    const res = await api.deleteFile(workflowDirPath(basePath.value, id))
    if (!res.ok) return false

    workflows.value = workflows.value.filter(w => w.id !== id)
    if (currentWorkflowId.value === id) {
      currentWorkflowId.value = workflows.value[0]?.id ?? null
    }
    await api.writeFile(indexFilePath(basePath.value), JSON.stringify(indexEntries.value, null, 2))
    return true
  }

  function selectWorkflow(id: string): void {
    currentWorkflowId.value = id
    selectedNodeId.value = null
  }

  // ── 节点 CRUD ─────────────────────────────────────────────────

  function addNode(type: string, x?: number, y?: number, label?: string): WorkflowNode | null {
    const wf = currentWorkflow.value
    if (!wf) return null
    const node = createNode(type, label)
    node.position = { x: x ?? 100, y: y ?? 100 }
    wf.nodes.push(node)
    selectedNodeId.value = node.id
    return node
  }

  function updateNode(nodeId: string, updates: Partial<WorkflowNode>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const idx = wf.nodes.findIndex(n => n.id === nodeId)
    if (idx !== -1) wf.nodes[idx] = { ...wf.nodes[idx], ...updates }
  }

  function removeNode(nodeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    // 删除节点时，同时删除所有关联的边
    wf.edges = wf.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    wf.nodes = wf.nodes.filter(n => n.id !== nodeId)
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  function moveNode(nodeId: string, x: number, y: number): void {
    const node = currentWorkflow.value?.nodes.find(n => n.id === nodeId)
    if (node) node.position = { x, y }
  }

  function disableNode(nodeId: string): void {
    const node = currentWorkflow.value?.nodes.find(n => n.id === nodeId)
    if (node) node.disabled = true
  }

  function enableNode(nodeId: string): void {
    const node = currentWorkflow.value?.nodes.find(n => n.id === nodeId)
    if (node) node.disabled = false
  }

  // ── 执行状态管理 ─────────────────────────────────────────────

  function setNodeStatus(nodeId: string, status: NodeExecutionStatus): void {
    const node = currentWorkflow.value?.nodes.find(n => n.id === nodeId)
    if (node) node.status = status
  }

  function resetAllNodeStatuses(): void {
    currentWorkflow.value?.nodes.forEach(n => { n.status = 'idle'; n.statusText = undefined })
  }

  function setNodeStatusText(nodeId: string, text: string | null): void {
    const node = currentWorkflow.value?.nodes.find(n => n.id === nodeId)
    if (node) node.statusText = text ?? undefined
  }

  function resetAllToEditing(): void {
    currentWorkflow.value?.nodes.forEach(n => { n.status = 'editing'; n.statusText = undefined })
  }

  // ── 日志管理 ─────────────────────────────────────────────────

  function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    logs.value.push({
      ...entry,
      id: generateId(),
      timestamp: nowISO()
    })
  }

  function clearLogs(): void {
    logs.value = []
  }

  // ── 边 CRUD ───────────────────────────────────────────────────

  function addEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): WorkflowEdge | null {
    const wf = currentWorkflow.value
    if (!wf) return null
    if (source === target) return null  // 禁止自环
    // 同一对节点同方向只允许一条边
    if (wf.edges.some(e => e.source === source && e.target === target)) return null

    const edge: WorkflowEdge = { id: generateId(), source, target, sourceHandle, targetHandle }
    wf.edges.push(edge)
    return edge
  }

  function removeEdge(edgeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.edges = wf.edges.filter(e => e.id !== edgeId)
  }

  // ── 返回公开 API ──────────────────────────────────────────────
  return {
    // 状态（只读）
    workflows,
    currentWorkflowId,
    currentWorkflow,
    selectedNodeId,
    selectedNode,
    isSaving,
    logs,
    basePath,
    indexEntries,
    // 初始化
    init,
    save,
    // 流程
    addWorkflow,
    removeWorkflow,
    selectWorkflow,
    // 节点
    addNode,
    updateNode,
    removeNode,
    selectNode,
    moveNode,
    disableNode,
    enableNode,
    // 执行状态
    setNodeStatus,
    setNodeStatusText,
    resetAllNodeStatuses,
    resetAllToEditing,
    // 日志
    addLog,
    clearLogs,
    // 边
    addEdge,
    removeEdge
  }
})

