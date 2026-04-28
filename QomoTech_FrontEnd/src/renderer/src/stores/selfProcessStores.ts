import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Workflow,
  WorkflowNode,
  WorkflowLog,
  WorkflowContext,
  NodeType,
  DataMapping,
  SkipCondition,
  NodeRunStatus,
  NodeOutput,
  WorkflowIndexEntry
} from '../types/selfProcessTypes'
import {
  generateId,
  createNewWorkflow,
  createDefaultNode,
  createLog,
  createDataMapping,
  createSkipCondition,
  resolveDataMappings,
  resetNodeRunStatus,
  buildWorkflowDirPath,
  buildWorkflowFilePath,
  buildIndexFilePath,
  nowLocale,
  nowISO
} from '../utils/selfProcessUtils'

const getApi = () => (window as unknown as { api: Record<string, (...args: unknown[]) => Promise<unknown>> }).api

export const useSelfProcessStore = defineStore('selfProcess', () => {
  // ──── State ────────────────────────────────────────────────
  const workflows = ref<Workflow[]>([])
  const currentWorkflowId = ref<string | null>(null)
  const workflowLogs = ref<WorkflowLog[]>([])
  const runContext = ref<WorkflowContext | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const isRunning = ref(false)
  const isSaving = ref(false)
  const workflowsBasePath = ref('')

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
    const pathResult = await (api.getWorkflowsPath as () => Promise<string>)()
    workflowsBasePath.value = pathResult
    await loadWorkflows()
  }

  // ──── 流程文件读写 ─────────────────────────────────────────
  async function loadWorkflows(): Promise<void> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    if (!basePath) return

    const indexResult = await (api.readFile as (p: string) => Promise<{ ok: boolean; data?: string; error?: string }>)(
      buildIndexFilePath(basePath)
    )

    if (indexResult.ok && indexResult.data) {
      try {
        const entries: WorkflowIndexEntry[] = JSON.parse(indexResult.data as string)
        const loaded: Workflow[] = []
        for (const entry of entries) {
          const wfPath = buildWorkflowFilePath(basePath, entry.id)
          const wfResult = await (api.readFile as (p: string) => Promise<{ ok: boolean; data?: string; error?: string }>)(wfPath)
          if (wfResult.ok && wfResult.data) {
            loaded.push(JSON.parse(wfResult.data as string))
          }
        }
        workflows.value = loaded
      } catch { /* ignore corrupt index */ }
    }
  }

  async function saveWorkflow(workflowId?: string): Promise<void> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    const wf = workflowId
      ? workflows.value.find((w) => w.id === workflowId)
      : currentWorkflow.value
    if (!wf || !basePath) return

    isSaving.value = true
    try {
      wf.updatedAt = nowISO()
      const wfPath = buildWorkflowFilePath(basePath, wf.id)
      await (api.writeFile as (p: string, c: string) => Promise<{ ok: boolean }>)(
        wfPath,
        JSON.stringify(wf, null, 2)
      )

      const indexPath = buildIndexFilePath(basePath)
      await (api.writeFile as (p: string, c: string) => Promise<{ ok: boolean }>)(
        indexPath,
        JSON.stringify(workflowIndexEntries.value, null, 2)
      )

      addLog('info', `流程「${wf.name}」已保存`)
    } finally {
      isSaving.value = false
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<void> {
    const api = getApi()
    const basePath = workflowsBasePath.value
    const wf = workflows.value.find((w) => w.id === workflowId)
    if (!wf || !basePath) return

    const dirPath = buildWorkflowDirPath(basePath, workflowId)
    await (api.deleteFile as (p: string) => Promise<{ ok: boolean }>)(dirPath)

    workflows.value = workflows.value.filter((w) => w.id !== workflowId)
    if (currentWorkflowId.value === workflowId) {
      currentWorkflowId.value = workflows.value[0]?.id ?? null
    }

    const indexPath = buildIndexFilePath(basePath)
    await (api.writeFile as (p: string, c: string) => Promise<{ ok: boolean }>)(
      indexPath,
      JSON.stringify(workflowIndexEntries.value, null, 2)
    )

    addLog('info', `流程「${wf.name}」已删除`)
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
  function addNode(type: NodeType, label?: string): WorkflowNode | null {
    const wf = currentWorkflow.value
    if (!wf) return null

    const node = createDefaultNode(type, label)
    node.position = calculateNextPosition(wf.nodes)
    wf.nodes.push(node)

    if (!wf.firstNodeId) {
      wf.firstNodeId = node.id
    }

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

    // 移除所有指向此节点的引用
    for (const n of wf.nodes) {
      if (n.nextNodeId === nodeId) n.nextNodeId = null
      n.skipConditions = n.skipConditions.filter((sc) => sc.targetNodeId !== nodeId)
    }

    wf.nodes = wf.nodes.filter((n) => n.id !== nodeId)

    if (wf.firstNodeId === nodeId) {
      wf.firstNodeId = wf.nodes[0]?.id ?? null
    }
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }

    addLog('info', `删除节点(ID: ${nodeId})`)
  }

  function connectNodes(fromId: string, toId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const fromNode = wf.nodes.find((n) => n.id === fromId)
    if (!fromNode) return
    fromNode.nextNodeId = toId
    addLog('info', `连接节点 ${fromId} → ${toId}`)
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

  // ──── 数据映射操作 ─────────────────────────────────────────
  function addDataMapping(nodeId: string, mapping: Omit<DataMapping, 'id'>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.dataMappings.push(createDataMapping(
      mapping.sourceType,
      mapping.targetField,
      mapping.sourceNodeId,
      mapping.sourceField,
      mapping.fixedValue
    ))
  }

  function removeDataMapping(nodeId: string, mappingId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.dataMappings = node.dataMappings.filter((m) => m.id !== mappingId)
  }

  // ──── 跳转条件操作 ─────────────────────────────────────────
  function addSkipCondition(nodeId: string, condition: Omit<SkipCondition, 'id'>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.skipConditions.push(createSkipCondition(
      condition.label,
      condition.when,
      condition.targetNodeId,
      condition.expression
    ))
  }

  function removeSkipCondition(nodeId: string, conditionId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.skipConditions = node.skipConditions.filter((c) => c.id !== conditionId)
  }

  // ──── 运行引擎 ────────────────────────────────────────────
  async function runWorkflow(): Promise<void> {
    const wf = currentWorkflow.value
    if (!wf || !wf.firstNodeId || isRunning.value) return

    isRunning.value = true
    wf.nodes = resetNodeRunStatus(wf.nodes)

    runContext.value = {
      workflowId: wf.id,
      runId: generateId(),
      nodeOutputs: {},
      variables: {},
      currentNodeId: null,
      status: 'running',
      startTime: nowISO()
    }

    workflowLogs.value = []
    addLog('info', `流程「${wf.name}」开始运行`)

    try {
      let currentNodeId: string | null = wf.firstNodeId
      const visited = new Set<string>()
      let loopGuard = 0

      while (currentNodeId && loopGuard < 100) {
        loopGuard++
        if (visited.has(currentNodeId)) {
          addLog('warn', `检测到循环，跳出 (节点: ${currentNodeId})`, currentNodeId)
          break
        }
        visited.add(currentNodeId)

        const node = wf.nodes.find((n) => n.id === currentNodeId)
        if (!node) {
          addLog('error', `节点 ${currentNodeId} 不存在`, currentNodeId)
          break
        }

        runContext.value.currentNodeId = node.id

        // 执行节点
        await executeNode(node)

        // 检查条件跳转
        const nextId = evaluateSkipConditions(node)
        currentNodeId = nextId ?? node.nextNodeId
      }

      runContext.value.status = 'completed'
      addLog('info', `流程「${wf.name}」运行完成`)
    } catch (e) {
      runContext.value.status = 'failed'
      addLog('error', `流程运行失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      isRunning.value = false
      runContext.value.currentNodeId = null
    }
  }

  async function executeNode(node: WorkflowNode): Promise<void> {
    const ctx = runContext.value
    if (!ctx) return

    node.runStatus = 'running'
    addLog('info', `执行节点「${node.label}」`, node.id)

    const startTime = nowISO()
    try {
      // 解析数据映射
      const resolvedInput = resolveDataMappings(node.dataMappings, ctx)

      // 根据节点类型执行
      let output: Record<string, unknown> = {}

      switch (node.type) {
        case 'task':
          output = await executeTaskNode(node, resolvedInput)
          break
        case 'condition':
          output = executeConditionNode(node, resolvedInput)
          break
        case 'delay':
          output = await executeDelayNode(node)
          break
        case 'loop':
          output = executeLoopNode(node)
          break
      }

      node.runStatus = 'success'
      const endTime = nowISO()
      ctx.nodeOutputs[node.id] = {
        status: 'success',
        data: output,
        startedAt: startTime,
        endedAt: endTime
      }
      addLog('info', `节点「${node.label}」执行成功`, node.id)
    } catch (e) {
      node.runStatus = 'failed'
      const endTime = nowISO()
      ctx.nodeOutputs[node.id] = {
        status: 'failed',
        data: {},
        startedAt: startTime,
        endedAt: endTime,
        error: e instanceof Error ? e.message : String(e)
      }
      addLog('error', `节点「${node.label}」执行失败: ${e instanceof Error ? e.message : String(e)}`, node.id)
      throw e
    }
  }

  // ──── 各节点类型执行逻辑 ──────────────────────────────────
  async function executeTaskNode(
    node: WorkflowNode,
    resolvedInput: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const endpoint = (node.config.apiEndpoint ?? '') as string
    const method = (node.config.apiMethod ?? 'POST') as string
    const timeout = (node.config.timeout ?? 30) as number

    if (!endpoint) {
      addLog('warn', `节点「${node.label}」未配置 API 端点，跳过`, node.id)
      return { success: true, result: { skipped: true } }
    }

    try {
      const baseUrl = 'http://127.0.0.1:5000'
      const url = `${baseUrl}${endpoint}`

      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout * 1000)
      }

      if (method === 'POST') {
        const mergedBody = { ...(node.config.apiBody as Record<string, unknown> ?? {}), ...resolvedInput }
        options.body = JSON.stringify(mergedBody)
      }

      addLog('info', `调用 API: ${method} ${endpoint}`, node.id)

      const response = await fetch(url, options)
      const data = await response.json()

      return { success: response.ok, result: data }
    } catch (e) {
      addLog('error', `API 调用失败: ${e instanceof Error ? e.message : String(e)}`, node.id)
      return { success: false, result: null, error: String(e) }
    }
  }

  function executeConditionNode(
    node: WorkflowNode,
    resolvedInput: Record<string, unknown>
  ): Record<string, unknown> {
    const operator = (node.config.operator ?? 'eq') as string
    const compareValue = (node.config.compareValue ?? '') as string
    const value = resolvedInput.value ?? resolvedInput['value']

    let matched = false
    switch (operator) {
      case 'eq':
        matched = String(value) === compareValue
        break
      case 'ne':
        matched = String(value) !== compareValue
        break
      case 'gt':
        matched = Number(value) > Number(compareValue)
        break
      case 'gte':
        matched = Number(value) >= Number(compareValue)
        break
      case 'lt':
        matched = Number(value) < Number(compareValue)
        break
      case 'lte':
        matched = Number(value) <= Number(compareValue)
        break
      case 'contains':
        matched = String(value).includes(compareValue)
        break
    }

    addLog('info', `条件判断: ${String(value)} ${operator} ${compareValue} = ${matched}`, node.id)
    return { matched }
  }

  async function executeDelayNode(node: WorkflowNode): Promise<Record<string, unknown>> {
    const seconds = (node.config.fixedSeconds ?? 1) as number
    addLog('info', `等待 ${seconds} 秒...`, node.id)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    return { elapsed: seconds }
  }

  function executeLoopNode(node: WorkflowNode): Record<string, unknown> {
    const count = (node.config.count ?? 1) as number
    addLog('info', `循环执行 ${count} 次`, node.id)
    return { currentItem: null, index: 0, total: count }
  }

  // ──── 条件跳转评估 ─────────────────────────────────────────
  function evaluateSkipConditions(node: WorkflowNode): string | null {
    for (const condition of node.skipConditions) {
      switch (condition.when) {
        case 'always':
          addLog('info', `条件跳转: "${condition.label}" → ${condition.targetNodeId}`, node.id)
          return condition.targetNodeId
        case 'on_success':
          if (node.runStatus === 'success') {
            addLog('info', `成功跳转: "${condition.label}" → ${condition.targetNodeId}`, node.id)
            return condition.targetNodeId
          }
          break
        case 'on_failure':
          if (node.runStatus === 'failed') {
            addLog('info', `失败跳转: "${condition.label}" → ${condition.targetNodeId}`, node.id)
            return condition.targetNodeId
          }
          break
        case 'expression':
          // 简单表达式解析
          if (condition.expression && evaluateSimpleExpression(condition.expression)) {
            addLog('info', `表达式跳转: "${condition.label}" → ${condition.targetNodeId}`, node.id)
            return condition.targetNodeId
          }
          break
      }
    }
    return null
  }

  function evaluateSimpleExpression(_expr: string): boolean {
    // 简化：直接返回 true，后续可以扩展
    return true
  }

  // ──── 停止运行 ────────────────────────────────────────────
  function stopWorkflow(): void {
    if (!isRunning.value) return
    isRunning.value = false
    if (runContext.value) {
      runContext.value.status = 'failed'
    }
    addLog('warn', '流程被手动停止')
  }

  // ──── 日志管理 ────────────────────────────────────────────
  function addLog(level: WorkflowLog['level'], message: string, nodeId?: string): void {
    const log = createLog(level, message, nodeId ?? null)
    workflowLogs.value.push(log)
    // 最多保留 500 条日志
    if (workflowLogs.value.length > 500) {
      workflowLogs.value = workflowLogs.value.slice(-500)
    }
  }

  function clearLogs(): void {
    workflowLogs.value = []
  }

  // ──── 辅助 ────────────────────────────────────────────────
  function calculateNextPosition(nodes: WorkflowNode[]): { x: number; y: number } {
    if (nodes.length === 0) return { x: 100, y: 100 }
    const maxY = Math.max(...nodes.map((n) => n.position.y))
    return { x: 100, y: maxY + 120 }
  }

  // ──── 返回 ────────────────────────────────────────────────
  return {
    workflows,
    currentWorkflowId,
    currentWorkflow,
    workflowLogs,
    runContext,
    selectedNodeId,
    selectedNode,
    isRunning,
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
    connectNodes,
    selectNode,
    updateNodePosition,
    addDataMapping,
    removeDataMapping,
    addSkipCondition,
    removeSkipCondition,
    runWorkflow,
    stopWorkflow,
    addLog,
    clearLogs
  }
})
