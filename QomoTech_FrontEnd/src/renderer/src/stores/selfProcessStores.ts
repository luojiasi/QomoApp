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
  nowISO
} from '../utils/selfProcessUtils'

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

class WorkflowStoppedError extends Error {
  constructor() {
    super('流程已停止')
    this.name = 'WorkflowStoppedError'
  }
}

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
  let stopRequested = false
  let activeAbortController: AbortController | null = null

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
        loaded.push(JSON.parse(wfResult.data) as Workflow)
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
    stopRequested = false
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
        ensureWorkflowRunning()
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
        ensureWorkflowRunning()

        // 检查条件跳转
        const nextId = evaluateSkipConditions(node)
        if (node.runStatus === 'failed' && !nextId) {
          addLog('error', `节点「${node.label}」执行失败且未配置失败跳转，流程停止`, node.id)
          break
        }
        currentNodeId = nextId ?? node.nextNodeId
      }

      if (runContext.value.status === 'running') {
        runContext.value.status = 'completed'
        addLog('info', `流程「${wf.name}」运行完成`)
      }
    } catch (e) {
      if (e instanceof WorkflowStoppedError) {
        if (runContext.value) runContext.value.status = 'failed'
        addLog('warn', '流程已停止')
      } else {
        if (runContext.value) runContext.value.status = 'failed'
        addLog('error', `流程运行失败: ${getErrorMessage(e)}`)
      }
    } finally {
      isRunning.value = false
      stopRequested = false
      activeAbortController = null
      if (runContext.value) runContext.value.currentNodeId = null
    }
  }

  async function executeNode(node: WorkflowNode): Promise<void> {
    const ctx = runContext.value
    if (!ctx) return

    node.runStatus = 'running'
    addLog('info', `执行节点「${node.label}」`, node.id)

    const startTime = nowISO()
    try {
      ensureWorkflowRunning()
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

      node.runStatus = output.success === false ? 'failed' : 'success'
      const endTime = nowISO()
      ctx.nodeOutputs[node.id] = {
        status: node.runStatus,
        data: output,
        startedAt: startTime,
        endedAt: endTime
      }
      if (node.runStatus === 'success') {
        addLog('info', `节点「${node.label}」执行成功`, node.id)
      } else {
        addLog('error', `节点「${node.label}」执行失败`, node.id)
      }
    } catch (e) {
      if (e instanceof WorkflowStoppedError) {
        node.runStatus = 'skipped'
        throw e
      }

      node.runStatus = 'failed'
      const endTime = nowISO()
      ctx.nodeOutputs[node.id] = {
        status: 'failed',
        data: {},
        startedAt: startTime,
        endedAt: endTime,
        error: e instanceof Error ? e.message : String(e)
      }
      addLog('error', `节点「${node.label}」执行失败: ${getErrorMessage(e)}`, node.id)
    }
  }

  // ──── 各节点类型执行逻辑 ──────────────────────────────────
  async function executeTaskNode(
    node: WorkflowNode,
    resolvedInput: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const endpoint = (node.config.apiEndpoint ?? '') as string
    const method = String(node.config.apiMethod ?? 'POST').toUpperCase()
    const timeout = (node.config.timeout ?? 30) as number

    if (!endpoint) {
      addLog('warn', `节点「${node.label}」未配置 API 端点，跳过`, node.id)
      return { success: true, result: { skipped: true } }
    }

    let timeoutId: number | null = null
    try {
      const baseUrl = 'http://127.0.0.1:5000'
      const apiBody = (node.config.apiBody as Record<string, unknown> | undefined) ?? {}
      const pathParams = (node.config.pathParams as Record<string, string> | undefined) ?? {}
      const mergedInput = { ...apiBody, ...resolvedInput }
      const endpointWithParams = replacePathParams(endpoint, { ...pathParams, ...mergedInput })
      const url = buildRequestUrl(`${baseUrl}${endpointWithParams}`, method, mergedInput, pathParams)
      const controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), timeout * 1000)
      activeAbortController = controller

      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      }

      if (!['GET', 'HEAD'].includes(method)) {
        options.body = JSON.stringify(mergedInput)
      }

      addLog('info', `调用 API: ${method} ${url.pathname}${url.search}`, node.id)

      const response = await fetch(url.toString(), options)
      const data = await parseResponseBody(response)

      return { success: response.ok, status: response.status, result: data }
    } catch (e) {
      if (stopRequested || (e instanceof DOMException && e.name === 'AbortError')) {
        ensureWorkflowRunning()
      }
      addLog('error', `API 调用失败: ${getErrorMessage(e)}`, node.id)
      return { success: false, result: null, error: String(e) }
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      activeAbortController = null
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
    await sleepWithStop(seconds * 1000)
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
          if (condition.expression && evaluateSimpleExpression(condition.expression, node)) {
            addLog('info', `表达式跳转: "${condition.label}" → ${condition.targetNodeId}`, node.id)
            return condition.targetNodeId
          }
          break
      }
    }
    return null
  }

  function evaluateSimpleExpression(expr: string, node: WorkflowNode): boolean {
    const normalized = expr.trim().replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '')
    const match = normalized.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<|contains)\s*(.+)$/)
    if (!match) {
      addLog('warn', `表达式格式不支持: ${expr}`, node.id)
      return false
    }

    const [, leftToken, operator, rightToken] = match
    const left = resolveExpressionValue(leftToken, node)
    const right = resolveExpressionValue(rightToken, node)
    return compareExpressionValues(left, operator, right)
  }

  // ──── 停止运行 ────────────────────────────────────────────
  function stopWorkflow(): void {
    if (!isRunning.value) return
    stopRequested = true
    isRunning.value = false
    activeAbortController?.abort()
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
  function ensureWorkflowRunning(): void {
    if (stopRequested || !isRunning.value) {
      throw new WorkflowStoppedError()
    }
  }

  async function sleepWithStop(ms: number): Promise<void> {
    const stepMs = 100
    let elapsed = 0
    while (elapsed < ms) {
      ensureWorkflowRunning()
      const waitMs = Math.min(stepMs, ms - elapsed)
      await new Promise((resolve) => window.setTimeout(resolve, waitMs))
      elapsed += waitMs
    }
    ensureWorkflowRunning()
  }

  function replacePathParams(endpoint: string, values: Record<string, unknown>): string {
    return endpoint.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = values[key]
      return encodeURIComponent(value === undefined || value === null ? '' : String(value))
    })
  }

  function buildRequestUrl(
    rawUrl: string,
    method: string,
    input: Record<string, unknown>,
    pathParams: Record<string, string>
  ): URL {
    const url = new URL(rawUrl)
    if (method === 'GET') {
      for (const [key, value] of Object.entries(input)) {
        if (key in pathParams || value === undefined || value === null) continue
        url.searchParams.set(key, serializeQueryValue(value))
      }
    }
    return url
  }

  function serializeQueryValue(value: unknown): string {
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  function resolveExpressionValue(token: string, node: WorkflowNode): unknown {
    const trimmed = token.trim()
    if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1)
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    if (trimmed === 'null') return null
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

    const ctx = runContext.value
    const output = ctx?.nodeOutputs[node.id]?.data ?? {}
    const path = trimmed
      .replace(/^\$self\./, '')
      .replace(/^self\./, '')
      .replace(/^output\./, '')

    if (path === 'status') return node.runStatus
    return getByPath(output, path)
  }

  function getByPath(source: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, source)
  }

  function compareExpressionValues(left: unknown, operator: string, right: unknown): boolean {
    switch (operator) {
      case '==':
      case '===':
        return normalizeComparable(left) === normalizeComparable(right)
      case '!=':
      case '!==':
        return normalizeComparable(left) !== normalizeComparable(right)
      case '>':
        return Number(left) > Number(right)
      case '>=':
        return Number(left) >= Number(right)
      case '<':
        return Number(left) < Number(right)
      case '<=':
        return Number(left) <= Number(right)
      case 'contains':
        return String(left).includes(String(right))
      default:
        return false
    }
  }

  function normalizeComparable(value: unknown): string | number | boolean | null | undefined {
    if (typeof value === 'string') {
      if (value === 'true') return true
      if (value === 'false') return false
      if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
    }
    return value as string | number | boolean | null | undefined
  }

  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

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
