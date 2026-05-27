// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/index.ts — 本地执行器注册表
//
// 新增 executeAs 类型：
//   1. 在此目录新建文件（如 conditionExecutor.ts）
//   2. 在下方 registry 中注册
//   3. 引擎自动识别，无需改其他文件
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'
import { executeDelay } from './delayExecutor'
import { executeCountdown } from './countdownExecutor'
import { executeSchedule } from './scheduleExecutor'

type LocalExecutor = (node: WorkflowNode, callbacks?: ExecutionCallbacks) => Promise<NodeRunResult>

const registry: Record<string, LocalExecutor> = {
  delay: executeDelay,
  countdown: executeCountdown,
  schedule: executeSchedule
}

/** 根据 executeAs 分派到对应本地执行器 */
export async function executeLocal(
  node: WorkflowNode,
  executeAs: string,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const executor = registry[executeAs]
  if (executor) return executor(node, callbacks)

  // 未注册的 executeAs → 直接通过
  return { nodeId: node.id, nodeType: node.type, status: 'success', output: {} }
}
