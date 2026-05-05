import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Workflow,
  WorkflowNode,
  WorkflowLog,
  WorkflowContext,
  NodeType,
  SkipCondition,
  WorkflowIndexEntry
} from '../types/selfProcessTypes'
import {
  generateId,
  createNewWorkflow,
  createDefaultNode,
  createLog,
  createSkipCondition,
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

// 获取渲染进程注入的文件读写 API
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
  // 初始化流程模块：获取目录并加载已有流程
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
  // 从索引文件和各流程文件加载流程列表
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

  // 保存单个流程及流程索引文件
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

  // 删除指定流程目录并更新索引
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
  // 创建一个新流程并切换为当前流程
  function createWorkflow(name: string): Workflow {
    const wf = createNewWorkflow(name)
    workflows.value.push(wf)
    currentWorkflowId.value = wf.id
    selectedNodeId.value = null
    addLog('info', `创建新流程「${name}」`)
    return wf
  }

  // 切换当前编辑的流程
  function selectWorkflow(workflowId: string): void {
    currentWorkflowId.value = workflowId
    selectedNodeId.value = null
  }

  // ──── 节点操作 ────────────────────────────────────────────
  // 向当前流程新增节点，可指定初始坐标与标签
  function addNode(type: NodeType, x?: number, y?: number, label?: string): WorkflowNode | null {
    const wf = currentWorkflow.value
    if (!wf) return null

    const node = createDefaultNode(type, label)
    node.position = { x: x ?? 10, y: y ?? 10 }
    wf.nodes.push(node)

    if (!wf.firstNodeId) {wf.firstNodeId = node.id}

    selectedNodeId.value = node.id
    addLog('info', `添加节点「${node.label}」(ID: ${node.id})`, node.id)
    return node
  }

  // 更新节点的部分字段
  function updateNode(nodeId: string, updates: Partial<WorkflowNode>): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const idx = wf.nodes.findIndex((n) => n.id === nodeId)
    if (idx === -1) return
    wf.nodes[idx] = { ...wf.nodes[idx], ...updates }
  }

  // 删除节点并清理关联引用（nextNodeId/skipConditions）
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

  // 建立两个节点的默认顺序连接
  function connectNodes(fromId: string, toId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const fromNode = wf.nodes.find((n) => n.id === fromId)
    if (!fromNode) return
    fromNode.nextNodeId = toId
    addLog('info', `连接节点 ${fromId} → ${toId}`)
  }

  // 设置当前选中节点
  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  // 更新节点在画布中的坐标位置
  function updateNodePosition(nodeId: string, x: number, y: number): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (node) {
      node.position = { x, y }
    }
  }

  // ──── 跳转条件操作 ─────────────────────────────────────────
  // 为指定节点新增一条跳转条件
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

  // 删除指定节点的一条跳转条件
  function removeSkipCondition(nodeId: string, conditionId: string): void {
    const wf = currentWorkflow.value
    if (!wf) return
    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.skipConditions = node.skipConditions.filter((c) => c.id !== conditionId)
  }

  // ──── 运行引擎 ────────────────────────────────────────────
  // 按节点链路执行当前流程，并维护运行上下文与日志
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
      let previousNodeId: string | null = null
      let loopGuard = 0

      while (currentNodeId && loopGuard < 100) {
        ensureWorkflowRunning()
        loopGuard++

        const node = wf.nodes.find((n) => n.id === currentNodeId)
        if (!node) {
          addLog('error', `节点 ${currentNodeId} 不存在`, currentNodeId)
          break
        }

        runContext.value.currentNodeId = node.id

        // 执行节点
        await executeNode(node, previousNodeId)
        ensureWorkflowRunning()

        previousNodeId = node.id
        currentNodeId =  node.nextNodeId
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

  // 执行单个节点并记录输入输出、状态与日志
  async function executeNode(node: WorkflowNode, previousNodeId: string | null): Promise<void> {
    const ctx = runContext.value
    if (!ctx) return

    node.runStatus = 'running'
    addLog('info', `执行节点「${node.label}」`, node.id)

    const startTime = nowISO()
    try {
      ensureWorkflowRunning()
      const resolvedInput = resolveNodeInput(ctx, previousNodeId)
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
      addLog('debug', `节点「${node.label}」执行结果: ${JSON.stringify(output)}`, node.id)

      node.runStatus = getNodeRunStatusFromOutput(output)
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

  function resolveNodeInput(context: WorkflowContext,previousNodeId: string | null): Record<string, unknown> {
    if (!previousNodeId) return {}
    const previousOutput = context.nodeOutputs[previousNodeId]?.data
    if (!previousOutput || typeof previousOutput !== 'object' || Array.isArray(previousOutput)) return {}
    return previousOutput as Record<string, unknown>
  }

  // 从节点输出中归一化提取成功/失败状态
  function getNodeRunStatusFromOutput(output: Record<string, unknown>): 'success' | 'failed' {
    const result = output.result
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const resultSuccess = (result as Record<string, unknown>).success
      if (typeof resultSuccess === 'boolean') return resultSuccess ? 'success' : 'failed'
    }

    return output.success === false ? 'failed' : 'success'
  }

  // ──── 各节点类型执行逻辑 ──────────────────────────────────
  // 执行任务节点：发起 HTTP 请求并返回统一结果
  async function executeTaskNode(node: WorkflowNode,resolvedInput: Record<string, unknown>): Promise<Record<string, unknown>> {
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
  // 执行延时节点：等待指定秒数
  async function executeDelayNode(node: WorkflowNode): Promise<Record<string, unknown>> {
    const seconds = (node.config.fixedSeconds ?? 1) as number
    addLog('info', `等待 ${seconds} 秒...`, node.id)
    await sleepWithStop(seconds * 1000)
    return { elapsed: seconds }
  }

  // 执行条件节点：已清空，等待重新实现
  function executeConditionNode(node: WorkflowNode,resolvedInput: Record<string, unknown>): Record<string, unknown> {
    void resolvedInput
    addLog('warn', `条件判断逻辑已清空，请重新编辑节点「${node.label}」的条件规则`, node.id)
    return {}
  }



  // 执行循环节点：已清空，等待重新实现
  function executeLoopNode(node: WorkflowNode): Record<string, unknown> {
    addLog('warn', `循环操作逻辑已清空，请重新编辑节点「${node.label}」的循环规则`, node.id)
    return {}
  }

  // ──── 条件跳转评估 ─────────────────────────────────────────
  

  // ──── 停止运行 ────────────────────────────────────────────
  // 手动停止流程运行并中断当前请求
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
  // 追加一条运行日志，并限制日志总量
  function addLog(level: WorkflowLog['level'], message: string, nodeId?: string): void {
    const log = createLog(level, message, nodeId ?? null)
    workflowLogs.value.push(log)
    // 最多保留 500 条日志
    if (workflowLogs.value.length > 500) {
      workflowLogs.value = workflowLogs.value.slice(-500)
    }
  }

  // 清空全部运行日志
  function clearLogs(): void {
    workflowLogs.value = []
  }

  // ──── 辅助 ────────────────────────────────────────────────
  // 校验流程是否仍处于可运行状态，否则抛出停止异常
  function ensureWorkflowRunning(): void {
    if (stopRequested || !isRunning.value) {
      throw new WorkflowStoppedError()
    }
  }

  // 可响应停止信号的睡眠函数
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

  // 将 endpoint 中的路径参数占位符替换为实际值
  function replacePathParams(endpoint: string, values: Record<string, unknown>): string {
    return endpoint.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = values[key]
      return encodeURIComponent(value === undefined || value === null ? '' : String(value))
    })
  }

  // 构造请求 URL（GET 方法自动拼接 query 参数）
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

  // 将 query 参数值序列化为字符串
  function serializeQueryValue(value: unknown): string {
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // 尝试解析响应体为 JSON，失败则返回原始文本
  async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  // 解析表达式 token：字面量、数字、布尔值或节点输出路径
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

  // 按点路径读取对象中的嵌套值
  function getByPath(source: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, source)
  }

  // 根据运算符比较左右值
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

  // 将可比较值标准化（字符串数字/布尔转实际类型）
  function normalizeComparable(value: unknown): string | number | boolean | null | undefined {
    if (typeof value === 'string') {
      if (value === 'true') return true
      if (value === 'false') return false
      if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
    }
    return value as string | number | boolean | null | undefined
  }

  // 将未知错误对象转换为可展示的错误消息
  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
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
    addSkipCondition,
    removeSkipCondition,
    runWorkflow,
    stopWorkflow,
    addLog,
    clearLogs
  }
})
