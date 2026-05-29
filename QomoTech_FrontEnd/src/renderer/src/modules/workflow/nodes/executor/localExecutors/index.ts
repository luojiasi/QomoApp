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
import { executePassthrough } from './passthroughExecutor'
import { executeCondition } from './conditionExecutor'
import { executeTransform } from './transformExecutor'
import { executeLoop, resetLoopState } from './loopExecutor'
import { executeLog } from './logExecutor'
import { executeLogExport } from './logExportExecutor'
import { executeNotify } from './notifyExecutor'
import { executeWaitAll } from './waitAllExecutor'
import { executeGetRecipe } from './recipeExecutor'


type LocalExecutor = (
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
) => Promise<NodeRunResult>

const registry: Record<string, LocalExecutor> = {
  delay: executeDelay,
  countdown: executeCountdown,
  schedule: executeSchedule,
  passthrough: executePassthrough,
  condition: executeCondition,
  transform: executeTransform,
  loop: executeLoop,
  log: executeLog,
  'log-export': executeLogExport,
  notify: executeNotify,
  wait_all: executeWaitAll,
  getRecipe: executeGetRecipe
}

export { resetLoopState }

/** 根据 executeAs 分派到对应本地执行器 */
export async function executeLocal(
  node: WorkflowNode,
  executeAs: string,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const executor = registry[executeAs]
  if (executor) return executor(node, upstreamData, callbacks)

  // 未注册的 executeAs → 直接通过
  return { nodeId: node.id, nodeType: node.type, status: 'success', output: {} }
}
