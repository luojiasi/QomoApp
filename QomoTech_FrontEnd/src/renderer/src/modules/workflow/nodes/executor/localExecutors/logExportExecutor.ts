// ─────────────────────────────────────────────────────────────
// localExecutors/logExportExecutor.ts — 日志导出执行器
//
// executeAs === 'log-export' 时调用。
// 将 store 中累积的执行日志格式化为 Markdown，
// 写入当前流程文件夹下的 logs.md。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { getWorkflowApi } from '../../../infra/workflowApiBridge'
import { workflowDirPath } from '../../../utils/workflowUtils'

function buildMarkdown(logs: Array<{ timestamp: string; nodeName: string; status: string; message: string }>): string {
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  const lines: string[] = [
    `# 工作流执行日志`,
    ``,
    `> 导出时间：${now}`,
    ``,
    `| 时间 | 节点 | 状态 | 消息 |`,
    `|------|------|------|------|`
  ]

  for (const log of logs) {
    const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })
    const statusMap: Record<string, string> = {
      success: '成功',
      failure: '失败',
      warning: '警告',
      running: '运行中'
    }
    const status = statusMap[log.status] ?? log.status
    const msg = log.message.replace(/\|/g, '\\|')
    lines.push(`| ${time} | ${log.nodeName || '-'} | ${status} | ${msg} |`)
  }

  lines.push('')
  return lines.join('\n')
}

export async function executeLogExport(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const store = useWorkflowStore()
  const logs = store.logs

  if (logs.length === 0) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'warning',
      output: (upstreamData['main'] ?? {}) as Record<string, unknown>,
      error: '没有可导出的日志'
    }
  }

  const wfId = store.currentWorkflowId
  const basePath = store.basePath
  if (!wfId || !basePath) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'failure',
      output: (upstreamData['main'] ?? {}) as Record<string, unknown>,
      error: '无法确定当前流程路径'
    }
  }

  const api = getWorkflowApi()
  if (!api) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'failure',
      output: (upstreamData['main'] ?? {}) as Record<string, unknown>,
      error: '当前环境不支持文件写入'
    }
  }

  const md = buildMarkdown(logs)
  const filePath = `${workflowDirPath(basePath, wfId)}/logs.md`

  callbacks?.onProgress?.(node.id, `正在导出 ${logs.length} 条日志到 logs.md...`)

  const result = await api.writeFile(filePath, md)
  if (!result.ok) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'failure',
      output: (upstreamData['main'] ?? {}) as Record<string, unknown>,
      error: `写入失败: ${result.error}`
    }
  }

  const mainData = (upstreamData['main'] ?? {}) as Record<string, unknown>
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { ...mainData, exportedFile: filePath, logCount: logs.length }
  }
}
