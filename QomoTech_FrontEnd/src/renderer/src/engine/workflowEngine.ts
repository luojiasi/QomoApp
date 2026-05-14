import type { Ref } from 'vue'
import type {
  Workflow,
  WorkflowNode,
  WorkflowLog,
  WorkflowContext,
  NodeOutput,
  NodeRunStatus
} from '@/modules/workflow/selfProcessTypes'
import { generateId } from '@/modules/workflow/selfProcessUtils'
import { resolveValue, type ResolverContext } from './expressionResolver'

// ──── API 端点映射 ──────────────────────────────────────────────
const NODE_API_MAP: Record<string, { endpoint: string; method: string }> = {
  'motion.connect': { endpoint: '/api/motion/connect', method: 'POST' },
  'motion.disconnect': { endpoint: '/api/motion/disconnect', method: 'POST' },
  'motion.move-abs': { endpoint: '/api/motion/axis/move-abs', method: 'POST' },
  'motion.move-rel': { endpoint: '/api/motion/axis/move-rel', method: 'POST' },
  'motion.rotate-u': { endpoint: '/api/motion/axis/U轴旋转的角度', method: 'POST' },
  'motion.rotate-r': { endpoint: '/api/motion/axis/R轴旋转的圈数', method: 'POST' },
  'motion.zero': { endpoint: '/api/motion/axis/zero', method: 'POST' },
  'motion.stop': { endpoint: '/api/motion/emergency-stop', method: 'POST' },
  'motion.get-position': { endpoint: '/api/motion/position/{axis_no}', method: 'GET' },
  'motion.set-params': { endpoint: '/api/motion/axes/params', method: 'POST' },
  'io.set-output': { endpoint: '/api/motion/io/output', method: 'POST' },
  'io.read-input': { endpoint: '/api/motion/io/input/{io_no}', method: 'GET' },
  'io.read-output': { endpoint: '/api/motion/io/output/{io_no}', method: 'GET' }
}

// ──── 错误类型 ──────────────────────────────────────────────────
class WorkflowStoppedError extends Error {
  constructor() {
    super('流程已停止')
    this.name = 'WorkflowStoppedError'
  }
}

// ──── 工具函数 ──────────────────────────────────────────────────
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeValue(val: unknown): unknown {
  if (typeof val === 'string') {
    if (val === 'true') return true
    if (val === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val)
  }
  return val
}
// ──── 依赖接口 ──────────────────────────────────────────────────
export interface WorkflowEngineDeps {
  getWorkflow: () => Workflow | null
  isRunning: Ref<boolean>
  runContext: Ref<WorkflowContext | null>
  addLog: (level: WorkflowLog['level'], message: string, nodeId?: string, data?: Record<string, unknown>) => void
  clearLogs: () => void
  hasBreakpoint: (nodeId: string) => boolean
  isBreakpointEnabled: () => boolean
  waitForBreakpoint: (nodeId: string) => Promise<void>
}

// ──── 引擎工厂 ──────────────────────────────────────────────────
export function createWorkflowEngine(deps: WorkflowEngineDeps) {
  let stopRequested = false
  let activeAbortController: AbortController | null = null

  // ──── 对外 API ────────────────────────────────────────────
  async function run(): Promise<void> {
    const wf = deps.getWorkflow()
    if (!wf || wf.nodes.length === 0 || deps.isRunning.value) return

    deps.isRunning.value = true
    stopRequested = false
    deps.clearLogs()
    // 在执行前就把所有节点的运行容器准备好，后续节点执行时只更新对应字段，不需要动态创建结构
    const nodeOutputs: Record<string, NodeOutput> = {}
    for (const node of wf.nodes) {
      nodeOutputs[node.id] = {
        status: 'idle',
        data: {},
        startedAt: '',
        endedAt: ''
      }
    }
    // 构建本次运行上下文
    deps.runContext.value = {
      workflowId: wf.id,      //当前流程 ID
      runId: generateId(),    //新生成的唯一运行 ID
      nodeOutputs,            // 上一步初始化好的节点状态表
      variables: {},          //运行时变量容器
      currentNodeId: null,    //当前执行节点（初始 null）
      status: 'running',
      startTime: new Date().toISOString()//启动时间
    }
    deps.addLog('info', `流程「${wf.name}」开始运行`)
    
    try { // 主执行逻辑
      const startNodeIds = resolveStartNodes(wf)  //计算起始节点列表
      if (startNodeIds.length > 0) await executeParallel(startNodeIds)
    
      if (deps.runContext.value?.status === 'running') {
        deps.runContext.value.status = 'completed'
        deps.addLog('info', `流程「${wf.name}」运行完成`)
      }
    } catch (e) {
      if (e instanceof WorkflowStoppedError) {
        if (deps.runContext.value) deps.runContext.value.status = 'failed'
        deps.addLog('warn', '流程已停止')
      } else {
        if (deps.runContext.value) deps.runContext.value.status = 'failed'
        deps.addLog('error', `流程运行失败: ${getErrorMessage(e)}`)
      }
    } finally {
      deps.isRunning.value = false
      stopRequested = false
      activeAbortController = null
      if (deps.runContext.value) deps.runContext.value.currentNodeId = null
    }
  }

  function stop(): void {
    if (!deps.isRunning.value) return
    stopRequested = true
    deps.isRunning.value = false
    activeAbortController?.abort()
    if (deps.runContext.value) deps.runContext.value.status = 'failed'
    deps.addLog('warn', '流程被手动停止')
  }

  // ──── 单节点运行（双击节点调试）───────────────────────────
  async function runSingleNode(nodeId: string): Promise<void> {
    const wf = deps.getWorkflow()
    if (!wf || deps.isRunning.value) return

    const node = wf.nodes.find((n) => n.id === nodeId)
    if (!node) return

    // 确保有运行上下文
    if (!deps.runContext.value) {
      const nodeOutputs: Record<string, NodeOutput> = {}
      for (const n of wf.nodes) {
        nodeOutputs[n.id] = { status: 'idle', data: {}, startedAt: '', endedAt: '' }
      }
      deps.runContext.value = {
        workflowId: wf.id,
        runId: generateId(),
        nodeOutputs,
        variables: {},
        currentNodeId: null,
        status: 'idle',
        startTime: new Date().toISOString()
      }
    }

    deps.addLog('info', `[单步调试] 执行节点「${node.label}」(${node.type})`, nodeId)

    // 临时设置 isRunning，避免 sleep/ensureRunning 抛出 WorkflowStoppedError
    deps.isRunning.value = true
    try {
      deps.runContext.value.currentNodeId = nodeId
      setNodeStatus(nodeId, 'running', {})

      const output = await executeNode(node)
      const ok = output.success !== false

      setNodeStatus(nodeId, ok ? 'success' : 'failed', output)

      if (ok) {
        deps.addLog('info', `[单步调试] 节点「${node.label}」执行成功`, nodeId, { output })
      } else {
        deps.addLog('error', `[单步调试] 节点「${node.label}」执行失败`, nodeId, { output })
      }
    } catch (e) {
      setNodeStatus(nodeId, 'failed', { error: getErrorMessage(e) })
      deps.addLog('error', `[单步调试] 节点执行异常: ${getErrorMessage(e)}`, nodeId)
    } finally {
      deps.isRunning.value = false
      deps.runContext.value.currentNodeId = null
    }
  }

  // ──── 解析起始节点 ────────────────────────────────────────
  function resolveStartNodes(wf: Workflow): string[] {
    const singleStarts = wf.nodes.filter((n) => n.type === 'workflowSystem.singleStart')
    const multiStarts = wf.nodes.filter((n) => n.type === 'workflowSystem.multiStart')

    // 不允许混用两种入口类型
    if (singleStarts.length > 0 && multiStarts.length > 0) {
      deps.addLog('error', '不允许同时使用「单一入口」和「并行入口」，请只保留一种')
      deps.runContext.value!.status = 'failed'
      return []
    }

    if (singleStarts.length > 0) {
      if (singleStarts.length > 1) {
        deps.addLog('error', `「单一入口」只允许添加一个，当前有 ${singleStarts.length} 个。如需多个入口请使用「并行入口」`)
        deps.runContext.value!.status = 'failed'
        return []
      }
      return [singleStarts[0].id]
    }

    if (multiStarts.length > 0) {
      return multiStarts.map((n) => n.id)
    }

    deps.addLog('error', '流程缺少入口节点，请添加「单一入口」或「并行入口」')
    deps.runContext.value!.status = 'failed'
    return []
  }

  // ──── 并行图执行（fire-and-forget 模型）────────────────────
  // 每个节点完成后立即触发就绪的下游节点，不等待兄弟节点
  // sharedCompleted: 流程级共享完成状态；循环迭代不共享
  async function executeParallel(startNodeIds: string[],sharedCompleted?: Map<string, boolean>): Promise<void> {
    const wf = deps.getWorkflow()!
    ///----------------------------------------------------
    ///状态初始化
    const completedNodes = sharedCompleted ?? new Map<string, boolean>()
    const queued = new Set<string>()  // 已触发执行的节点，防止重复启动
    let flying = 0                    // 当前正在执行的节点数
    let stepCount = 0
    const maxSteps = 200
    let failed = false

    let resolvePromise!: () => void
    const done = new Promise<void>((resolve) => {resolvePromise = resolve})
    function finish() {if (flying === 0) resolvePromise()}
    ///----------------------------------------------------


    
    // 判断节点是否就绪：
    // - 无入边：就绪
    // - 入边按 targetHandle 分组，同一 handle 的边为 OR（任一源完成即可），
    //   不同 handle 之间为 AND（每个 handle 都需有源完成）
    function isNodeReady(nodeId: string): boolean {
      if (completedNodes.has(nodeId)) return false
      if (queued.has(nodeId)) return false
      const incoming = wf.edges.filter((e) => e.target === nodeId)
      if (incoming.length === 0) return true

      const groups = new Map<string, boolean>()
      for (const e of incoming) {
        const handle = e.targetHandle ?? '__default'
        if (!groups.has(handle)) groups.set(handle, false)
        if (completedNodes.get(e.source) === true || (e.sourceHandle === 'error' && completedNodes.has(e.source))) {
          groups.set(handle, true)
        }
      }
      return [...groups.values()].every((ok) => ok)
    }

    // 检测回边重入：所有 handle 分组都有已完成源 → 允许重置并重新执行
    function canReEnter(nodeId: string): boolean {
      const incoming = wf.edges.filter((e) => e.target === nodeId)
      if (incoming.length === 0) return false
      const groups = new Map<string, boolean>()
      for (const e of incoming) {
        const handle = e.targetHandle ?? '__default'
        if (!groups.has(handle)) groups.set(handle, false)
        if (completedNodes.has(e.source)) groups.set(handle, true)
      }
      return [...groups.values()].every((ok) => ok)
    }

    // 尝试启动下游节点（如果就绪则立即执行，不等待）
    function launchIfReady(nodeId: string) {
      if (failed) return
      if (completedNodes.has(nodeId)) {
        if (canReEnter(nodeId)) {
          completedNodes.delete(nodeId)
          queued.delete(nodeId)
        } else {
          return
        }
      }
      if (!isNodeReady(nodeId)) return
      queued.add(nodeId)
      executeAndPropagate(nodeId)
    }

    // 执行一个节点，完成后立即触发其下游
    async function executeAndPropagate(nodeId: string) {
      flying++
      stepCount++
      if (stepCount > maxSteps) {
        failed = true
        deps.runContext.value!.status = 'failed'
        deps.addLog('error', '流程步骤超过上限')
        flying--
        finish()
        return
      }

      try {
        ensureRunning()  //校验流程没被 stop

        const node = wf.nodes.find((n) => n.id === nodeId)
        if (!node) {
          completedNodes.set(nodeId, false)
          return  //节点不存在，直接返回
        }

        deps.runContext.value!.currentNodeId = nodeId
        setNodeStatus(nodeId, 'running', {})

        // 断点检测：如果此节点设置了断点且断点模式开启，暂停等待
        if (deps.isBreakpointEnabled() && deps.hasBreakpoint(nodeId)) {
          deps.addLog('debug', `断点暂停 → 节点「${node.label}」`, nodeId)
          await deps.waitForBreakpoint(nodeId)
          deps.addLog('debug', `断点继续 → 节点「${node.label}」`, nodeId)
        }

        const output = await executeNode(node) //调用 API / 延时 / 条件判断 / 变量操作
        const ok = output.success !== false

        completedNodes.set(nodeId, ok)
        setNodeStatus(nodeId, ok ? 'success' : 'failed', output)

        // ──── 触发下游 ──────────────────────────────────
        const outgoing = wf.edges.filter((e) => e.source === nodeId)

        if (!ok) {
          deps.addLog('error', `节点「${node.label}」执行失败`, nodeId)
          // 检查是否有 error 出口：有就走 error 分支，否则停止流程
          const errorEdges = outgoing.filter((e) => e.sourceHandle === 'error')
          if (errorEdges.length > 0) {
            for (const edge of errorEdges) launchIfReady(edge.target)
          } else {
            failed = true
            deps.runContext.value!.status = 'failed'
          }
          return
        }

        if (node.type === 'flow.loop') {
          // 循环节点：顺序执行循环体，然后走 done 分支
          const loopEdge = outgoing.find((e) => e.sourceHandle === 'loop')
          const doneEdge = outgoing.find((e) => e.sourceHandle === 'done')
          const count = (node.config.count ?? 1) as number

          for (let i = 0; i < count; i++) {
            ensureRunning()
            deps.addLog('info', `循环 ${i + 1}/${count}`, nodeId)
            if (loopEdge) {
              // 循环体内部独立执行，不共享 completed（允许重复执行）
              await executeParallel([loopEdge.target])
            }
          }
          if (doneEdge) launchIfReady(doneEdge.target)
        } else {
          // 普通/条件节点：立即触发所有就绪的下游
          let candidateEdgeTargets: string[]
          if (node.type.startsWith('flow.condition')) {
            const result = output._conditionResult as boolean | undefined
            const handle = result ? 'true' : 'false'
            candidateEdgeTargets = outgoing
              .filter((e) => e.sourceHandle === handle)
              .map((e) => e.target)
          } else {
            // 成功：只走非 error 出口
            candidateEdgeTargets = [...new Set(
              outgoing
                .filter((e) => e.sourceHandle !== 'error')
                .map((e) => e.target)
            )]
          }
          for (const targetId of candidateEdgeTargets) {
            launchIfReady(targetId)
          }
        }
      } catch (e) {
        failed = true
        if (!(e instanceof WorkflowStoppedError)) {
          deps.addLog('error', `节点执行异常: ${getErrorMessage(e)}`, nodeId)
        }
      } finally {
        flying--
        finish()
      }
    }


    ///============================
    /// 启动所有起始节点
    for (const id of startNodeIds) {
      launchIfReady(id)
    }
    ///============================
    ///============================
    ///同步等待
    finish()
    await done  //等待所有节点完成
    ///============================
  }

  // ————  设置节点状态  ————————————————————————
  function setNodeStatus(nodeId: string,status: string,data: Record<string, unknown>): void {
    const ctx = deps.runContext.value
    if (!ctx) return
    const prev = ctx.nodeOutputs[nodeId]
    ctx.nodeOutputs[nodeId] = {
      status: status as NodeRunStatus,
      data,
      startedAt: prev?.startedAt || (status === 'running' ? new Date().toISOString() : ''),
      endedAt: status !== 'running' ? new Date().toISOString() : ''
    }
  }

  // ──── 节点执行 ────────────────────────────────────────────
  async function executeNode(node: WorkflowNode): Promise<Record<string, unknown>> {
    deps.addLog('info', `执行节点「${node.label}」(${node.type})`, node.id)

    const type = node.type
    if (type.startsWith('motion.') || type.startsWith('io.')) {
      return await executeApiNode(node)
    }
    switch (type) {
      case 'workflowSystem.singleStart':
      case 'workflowSystem.multiStart':
        return { success: true }
      case 'flow.delay':
        return await executeDelayNode(node)
      case 'flow.condition':
        return executeConditionNode(node)
      case 'flow.loop':
        return { success: true }
      case 'flow.setVariable':
        return executeSetVariableNode(node)
      case 'flow.getVariable':
        return executeGetVariableNode(node)
      default:
        deps.addLog('warn', `未知节点类型: ${type}`, node.id)
        return { success: true }
    }
  }

  // ──── API 调用 ────────────────────────────────────────────
  async function executeApiNode(node: WorkflowNode): Promise<Record<string, unknown>> {
    const apiDef = NODE_API_MAP[node.type]
    if (!apiDef) {
      deps.addLog('warn', `节点「${node.label}」无 API 映射，跳过`, node.id)
      return { success: true }
    }

    const { endpoint, method } = apiDef
    const config = resolveValue(
      { ...node.config },
      buildResolverContext(node.id)
    ) as Record<string, unknown>
    const timeout = 30

    let resolvedEndpoint = endpoint
    for (const [key, val] of Object.entries(config)) {
      resolvedEndpoint = resolvedEndpoint.replace(`{${key}}`, encodeURIComponent(String(val)))
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const baseUrl = 'http://127.0.0.1:5000'
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), timeout * 1000)
      activeAbortController = controller

      const url = new URL(`${baseUrl}${resolvedEndpoint}`)
      if (method === 'GET') {
        for (const [key, val] of Object.entries(config)) {
          if (!resolvedEndpoint.includes(`{${key}}`)) {
            url.searchParams.set(key, String(val))
          }
        }
      }

      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      }

      if (method !== 'GET') {
        options.body = JSON.stringify(config)
      }

      deps.addLog('info', `调用 API: ${method} ${resolvedEndpoint}`, node.id, { config })

      const response = await fetch(url.toString(), options)
      const data = await parseResponseBody(response)

      // 判断成功：HTTP 2xx 且响应体没有 success: false
      const bodyFailed =
        data && typeof data === 'object' && (data as Record<string, unknown>).success === false
      const ok = response.ok && !bodyFailed

      const result = { success: ok, status: response.status, result: data }
      deps.addLog(ok ? 'info' : 'error', `API 响应: ${response.status}`, node.id, {
        response: data,
        status: response.status
      })
      return result
    } catch (e) {
      if (stopRequested || (e instanceof DOMException && e.name === 'AbortError')) {
        ensureRunning()
      }
      deps.addLog('error', `API 调用失败: ${getErrorMessage(e)}`, node.id)
      return { success: false, error: String(e) }
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId)
      activeAbortController = null
    }
  }

  // ──── 延时节点 ────────────────────────────────────────────
  async function executeDelayNode(node: WorkflowNode): Promise<Record<string, unknown>> {
    const seconds = (node.config.seconds ?? 1) as number
    deps.addLog('info', `等待 ${seconds} 秒...`, node.id, { seconds })
    await sleep(seconds * 1000)
    return { success: true, elapsed: seconds }
  }

  // ──── 条件节点 ────────────────────────────────────────────
  function executeConditionNode(node: WorkflowNode): Record<string, unknown> {
    // 左右操作数分别关联各自的输入端口
    const leftCtx = buildResolverContext(node.id, 'input')
    const rightCtx = buildResolverContext(node.id, 'compare')
    const left = resolveValue(node.config.leftOperand ?? '', leftCtx)
    const right = resolveValue(node.config.rightOperand ?? '', rightCtx)
    const operator = (node.config.operator ?? 'eq') as string

    const result = evaluateCondition(String(left), operator, String(right))
    deps.addLog('info', `条件判断: ${left} ${operator} ${right} → ${result}`, node.id, {
      left, operator, right, result
    })
    return { success: true, _conditionResult: result }
  }

  function evaluateCondition(left: string, operator: string, right: string): boolean {
    let leftVal: unknown = left
    let rightVal: unknown = right

    leftVal = normalizeValue(leftVal)
    rightVal = normalizeValue(rightVal)

    switch (operator) {
      case 'eq': return leftVal === rightVal
      case 'ne': return leftVal !== rightVal
      case 'gt': return Number(leftVal) > Number(rightVal)
      case 'gte': return Number(leftVal) >= Number(rightVal)
      case 'lt': return Number(leftVal) < Number(rightVal)
      case 'lte': return Number(leftVal) <= Number(rightVal)
      case 'contains': return String(leftVal).includes(String(rightVal))
      default: return false
    }
  }

  // ──── 流程变量节点 ────────────────────────────────────────
  function executeSetVariableNode(node: WorkflowNode): Record<string, unknown> {
    const resCtx = buildResolverContext(node.id)
    const varName = String(resolveValue(node.config.varName ?? '', resCtx) ?? '')
    const value = resolveValue(node.config.value ?? '', resCtx)
    if (deps.runContext.value && varName) {
      deps.runContext.value.variables[varName] = value
    }
    deps.addLog('info', `设置变量 $${varName} = ${JSON.stringify(value)}`, node.id)
    return { success: true, [varName]: value }
  }

  function executeGetVariableNode(node: WorkflowNode): Record<string, unknown> {
    const resCtx = buildResolverContext(node.id)
    const varName = String(resolveValue(node.config.varName ?? '', resCtx) ?? '')
    const value = deps.runContext.value?.variables[varName]
    deps.addLog('info', `获取变量 $${varName} = ${JSON.stringify(value)}`, node.id)
    return { success: true, varName, value }
  }


  function getPreviousNodeOutput(nodeId: string, targetHandle?: string): Record<string, unknown> | undefined {
    const wf = deps.getWorkflow()
    if (!wf) return undefined
    const incomingEdges = wf.edges.filter((e) => e.target === nodeId)
    // 如果指定了 targetHandle，优先匹配对应的入边
    let edge = incomingEdges[0]
    if (targetHandle) {
      edge = incomingEdges.find((e) => e.targetHandle === targetHandle) ?? incomingEdges[0]
    }
    const prevId = edge?.source
    if (!prevId) return undefined
    return deps.runContext.value?.nodeOutputs[prevId]?.data
  }

  function getNodeOutputByLabel(label: string): Record<string, unknown> | undefined {
    const wf = deps.getWorkflow()
    if (!wf) return undefined
    const node = wf.nodes.find((n) => n.label === label)
    if (!node) return undefined
    return deps.runContext.value?.nodeOutputs[node.id]?.data
  }

  function buildResolverContext(nodeId: string, targetHandle?: string): ResolverContext {
    return {
      ctx: deps.runContext.value!,
      currentNodeId: nodeId,
      getPreviousNodeOutput: (nid: string, th?: string) =>
        getPreviousNodeOutput(nid, th ?? targetHandle),
      getNodeOutputByLabel
    }
  }

  // ──── 可控延时 ────────────────────────────────────────────
  async function sleep(ms: number): Promise<void> {
    const step = 100
    let elapsed = 0
    while (elapsed < ms) {
      ensureRunning()
      await new Promise((r) => setTimeout(r, Math.min(step, ms - elapsed)))
      elapsed += step
    }
    ensureRunning()
  }

  function ensureRunning(): void {
    if (stopRequested || !deps.isRunning.value) {
      throw new WorkflowStoppedError()
    }
  }

  async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  }

  return { run, stop, runSingleNode }
}
