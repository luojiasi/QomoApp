import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowLog,
  WorkflowContext,
  WorkflowIndexEntry
} from '../types/selfProcessTypes'
import {
  generateId,
  createNewWorkflow,
  createDefaultNode,
  createLog,
  buildWorkflowDirPath,
  buildWorkflowFilePath,
  buildIndexFilePath,
  nowISO
} from '../utils/selfProcessUtils'
import { getNodeDefinition } from '../config/selfProcessConfig'
import { createWorkflowEngine } from '@/engine/workflowEngine'

type WorkflowFileResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

type WorkflowApi = {
  getWorkflowsPath: () => Promise<string>
  readFile: (path: string) => Promise<WorkflowFileResult<string>>
  writeFile: (path: string, content: string) => Promise<WorkflowFileResult<null>>
  deleteFile: (path: string) => Promise<WorkflowFileResult<null>>
}

const getApi = (): WorkflowApi | null =>
  ((window as unknown as { api?: WorkflowApi }).api ?? null)

export const useSelfProcessStore = defineStore('selfProcess', () => {
  // ──── State ────────────────────────────────────────────────
  const workflows = ref<Workflow[]>([])
  const currentWorkflowId = ref<string | null>(null)
  const workflowLogs = ref<WorkflowLog[]>([])
  const selectedNodeId = ref<string | null>(null)
  const isSaving = ref(false)
  const isRunning = ref(false)
  const runContext = ref<WorkflowContext | null>(null)
  const workflowsBasePath = ref('')

  // ──── 画布配置 ────────────────────────────────────────────
  const snapToGrid = ref(true)
  const snapGridSize = ref(20)
  const bgGap = ref(20)
  const bgSize = ref(6)
  const bgColor = ref('#575757')
  const showMiniMap = ref(true)
  const miniMapWidth = ref(160)
  const miniMapHeight = ref(100)
  const miniMapPosition = ref<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-left')

  // ──── 断点调试 ────────────────────────────────────────────
  const breakpointEnabled = ref(false)
  const breakpointNodeIds = ref<Set<string>>(new Set())
  const breakpointPaused = ref(false)
  const breakpointPausedNodeId = ref<string | null>(null)
  let breakpointResolve: (() => void) | null = null

  // ──── Computed ────────────────────────────────────────────
  const currentWorkflow = computed(() =>
    workflows.value.find((w) => w.id === currentWorkflowId.value) ?? null
  )

  const selectedNode = computed(() => {
    if (!currentWorkflow.value || !selectedNodeId.value) return null
    return currentWorkflow.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null
  })

  const workflowIndexEntries = computed((): WorkflowIndexEntry[] =>
    workflows.value.map((w) => ({ id: w.id, name: w.name, updatedAt: w.updatedAt }))
  )

  // ──── 初始化 ──────────────────────────────────────────────
  async function init(): Promise<void> {
    const api = getApi()
    if (!api) {
      addLog('error', '当前环境未注入文件 API，无法使用自定流程')
      return
    }

    try {
      workflowsBasePath.value = await api.getWorkflowsPath()
      await loadWorkflows()
    } catch (e) {
      addLog('error', `初始化流程目录失败: ${getErrorMessage(e)}`)
    }
  }

  // ──── 流程文件读写 ─────────────────────────────────────────
  async function loadWorkflows(): Promise<void> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    if (!api || !basePath) return

    const indexPath = buildIndexFilePath(basePath)
    const indexResult = await api.readFile(indexPath)
    if (!indexResult.ok) {
      addLog('warn', `未读取到流程索引，将从空列表开始: ${indexResult.error}`)
      workflows.value = []
      currentWorkflowId.value = null
      return
    }

    if (!indexResult.data) {
      workflows.value = []
      currentWorkflowId.value = null
      return
    }

    try {
      const entries = JSON.parse(indexResult.data) as WorkflowIndexEntry[]
      const loaded: Workflow[] = []

      for (const entry of entries) {
        const wfPath = buildWorkflowFilePath(basePath, entry.id)
        const wfResult = await api.readFile(wfPath)
        if (!wfResult.ok) {
          addLog('warn', `流程「${entry.name}」读取失败: ${wfResult.error}`)
          continue
        }
        if (!wfResult.data) continue
        const wf = JSON.parse(wfResult.data) as Workflow
        // 兼容旧数据：旧 Workflow 没有 edges 字段
        if (!Array.isArray(wf.edges)) {
          wf.edges = []
          // 从旧 nextNodeId 迁移为 edges
          if (wf.nodes && Array.isArray(wf.nodes)) {
            for (const node of wf.nodes as (WorkflowNode & { nextNodeId?: string | null })[]) {
              if (node.nextNodeId) {
                wf.edges.push({
                  id: generateId(),
                  source: node.id,
                  target: node.nextNodeId
                })
              }
              delete node.nextNodeId
              delete (node as unknown as Record<string, unknown>).skipConditions
              delete (node as unknown as Record<string, unknown>).runStatus
            }
          }
          delete (wf as unknown as Record<string, unknown>).firstNodeId
        }
        loaded.push(wf)
      }

      workflows.value = loaded
      currentWorkflowId.value = loaded[0]?.id ?? null
    } catch (e) {
      workflows.value = []
      currentWorkflowId.value = null
      addLog('error', `流程索引解析失败: ${getErrorMessage(e)}`)
    }
  }

  async function saveWorkflow(workflowId?: string): Promise<boolean> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    const wf = workflowId
      ? workflows.value.find((w) => w.id === workflowId)
      : currentWorkflow.value
    if (!wf || !basePath || !api) return false

    isSaving.value = true
    try {
      wf.updatedAt = nowISO()
      const wfPath = buildWorkflowFilePath(basePath, wf.id)
      const workflowResult = await api.writeFile(
        wfPath,
        JSON.stringify(wf, null, 2)
      )
      if (!workflowResult.ok) {
        addLog('error', `流程「${wf.name}」保存失败: ${workflowResult.error}`)
        return false
      }

      const indexPath = buildIndexFilePath(basePath)
      const indexResult = await api.writeFile(
        indexPath,
        JSON.stringify(workflowIndexEntries.value, null, 2)
      )
      if (!indexResult.ok) {
        addLog('error', `流程索引保存失败: ${indexResult.error}`)
        return false
      }

      addLog('info', `流程「${wf.name}」已保存`)
      return true
    } catch (e) {
      addLog('error', `流程「${wf.name}」保存异常: ${getErrorMessage(e)}`)
      return false
    } finally {
      isSaving.value = false
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<boolean> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    const wf = workflows.value.find((w) => w.id === workflowId)
    if (!wf || !basePath || !api) return false

    const dirPath = buildWorkflowDirPath(basePath, workflowId)
    const deleteResult = await api.deleteFile(dirPath)
    if (!deleteResult.ok) {
      addLog('error', `流程「${wf.name}」删除失败: ${deleteResult.error}`)
      return false
    }

    workflows.value = workflows.value.filter((w) => w.id !== workflowId)
    if (currentWorkflowId.value === workflowId) {
      currentWorkflowId.value = workflows.value[0]?.id ?? null
    }

    const indexPath = buildIndexFilePath(basePath)
    const indexResult = await api.writeFile(
      indexPath,
      JSON.stringify(workflowIndexEntries.value, null, 2)
    )
    if (!indexResult.ok) {
      addLog('error', `删除后流程索引保存失败: ${indexResult.error}`)
      return false
    }

    addLog('info', `流程「${wf.name}」已删除`)
    return true
  }

  // ──── 流程操作 ────────────────────────────────────────────
  function createWorkflow(name: string): Workflow {
    const wf = createNewWorkflow(name)
    workflows.value.push(wf)
    currentWorkflowId.value = wf.id
    selectedNodeId.value = null
    addLog('info', `创建新流程「${name}」`)
    return wf
  }

  function selectWorkflow(workflowId: string): void {
    currentWorkflowId.value = workflowId
    selectedNodeId.value = null
  }

  // ──── 节点操作 ────────────────────────────────────────────
  function addNode(type: string, x?: number, y?: number, label?: string): WorkflowNode | null {
    const wf = currentWorkflow.value
    if (!wf) return null

    const def = getNodeDefinition(type)
    const node = createDefaultNode(type, label ?? def?.label)
    node.position = { x: x ?? 100, y: y ?? 100 }
    // 合并 definition 默认参数到 config
    if (def) {
      node.config = { ...def.defaults }
    }
    wf.nodes.push(node)

    selectedNodeId.value = node.id
    addLog('info', `添加节点「${node.label}」(ID: ${node.id})`, node.id)
    return node
  }

  function updateNode(nodeId: string, updates: Partial<WorkflowNode>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const idx = wf.nodes.findIndex((n) => n.id === nodeId)
    if (idx === -1) return
    wf.nodes[idx] = { ...wf.nodes[idx], ...updates }
  }

  function removeNode(nodeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return

    // 移除与该节点相关的所有边
    wf.edges = wf.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    wf.nodes = wf.nodes.filter((n) => n.id !== nodeId)

    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }

    addLog('info', `删除节点(ID: ${nodeId})`)
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  function updateNodePosition(nodeId: string, x: number, y: number): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (node) {
      node.position = { x, y }
    }
  }

  // ──── 边操作 ──────────────────────────────────────────────
  function addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): WorkflowEdge | null {
    const wf = currentWorkflow.value
    if (!wf) return null
    // 防止自连接
    if (source === target) return null
    // 防止重复连接
    if (wf.edges.some((e) => e.source === source && e.target === target)) return null

    const edge: WorkflowEdge = {
      id: generateId(),
      source,
      target,
      sourceHandle,
      targetHandle
    }
    wf.edges.push(edge)
    addLog('info', `连接节点 ${source} → ${target}`)
    return edge
  }

  function removeEdge(edgeId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    wf.edges = wf.edges.filter((e) => e.id !== edgeId)
    addLog('info', `删除连线(ID: ${edgeId})`)
  }

  // ──── 执行引擎 ──────────────────────────────────────────────
  const engine = createWorkflowEngine({
    getWorkflow: () => currentWorkflow.value,
    isRunning,
    runContext,
    addLog,
    clearLogs,
    hasBreakpoint,
    isBreakpointEnabled: () => breakpointEnabled.value,
    waitForBreakpoint
  })

  function runWorkflow(): Promise<void> {
    return engine.run()
  }

  function stopWorkflow(): void {
    engine.stop()
  }

  async function runSingleNode(nodeId: string): Promise<void> {
    return engine.runSingleNode(nodeId)
  }

  // ──── 日志管理 ────────────────────────────────────────────
  function addLog(level: WorkflowLog['level'], message: string, nodeId?: string, data?: Record<string, unknown>): void {
    const log = createLog(level, message, nodeId ?? null, data)
    workflowLogs.value.push(log)
    if (workflowLogs.value.length > 500) {
      workflowLogs.value = workflowLogs.value.slice(-500)
    }
  }

  function clearLogs(): void {
    workflowLogs.value = []
  }

  // ──── 辅助 ────────────────────────────────────────────────
  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  // ──── 断点操作 ───────────────────────────────────────────
  function toggleBreakpoint(nodeId: string): void {
    const next = new Set(breakpointNodeIds.value)
    if (next.has(nodeId)) {
      next.delete(nodeId)
    } else {
      next.add(nodeId)
    }
    breakpointNodeIds.value = next
    addLog('debug', next.has(nodeId) ? `设置断点` : `取消断点`, nodeId)
  }

  function hasBreakpoint(nodeId: string): boolean {
    return breakpointNodeIds.value.has(nodeId)
  }

  function setBreakpointEnabled(enabled: boolean): void {
    breakpointEnabled.value = enabled
    if (!enabled) {
      // 关闭断点模式时自动恢复执行
      breakpointPaused.value = false
      breakpointPausedNodeId.value = null
      if (breakpointResolve) {
        breakpointResolve()
        breakpointResolve = null
      }
    }
  }

  async function waitForBreakpoint(nodeId: string): Promise<void> {
    if (!breakpointEnabled.value || !hasBreakpoint(nodeId)) return
    breakpointPaused.value = true
    breakpointPausedNodeId.value = nodeId
    return new Promise<void>((resolve) => {
      breakpointResolve = resolve
    })
  }

  function resumeFromBreakpoint(): void {
    if (breakpointResolve) {
      breakpointPaused.value = false
      breakpointPausedNodeId.value = null
      breakpointResolve()
      breakpointResolve = null
    }
  }

  // ──── 返回 ────────────────────────────────────────────────
  return {
    workflows,
    currentWorkflowId,
    currentWorkflow,
    workflowLogs,
    selectedNodeId,
    selectedNode,
    isSaving,
    workflowsBasePath,
    init,
    loadWorkflows,
    saveWorkflow,
    deleteWorkflow,
    createWorkflow,
    selectWorkflow,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    selectNode,
    updateNodePosition,
    addLog,
    clearLogs,
    isRunning,
    runContext,
    runWorkflow,
    stopWorkflow,
    runSingleNode,
    breakpointEnabled,
    breakpointNodeIds,
    breakpointPaused,
    breakpointPausedNodeId,
    toggleBreakpoint,
    hasBreakpoint,
    setBreakpointEnabled,
    waitForBreakpoint,
    resumeFromBreakpoint,
    snapToGrid,
    snapGridSize,
    bgGap,
    bgSize,
    bgColor,
    showMiniMap,
    miniMapWidth,
    miniMapHeight,
    miniMapPosition
  }
})