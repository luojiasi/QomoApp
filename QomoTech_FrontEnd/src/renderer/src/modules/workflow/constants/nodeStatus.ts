// ─────────────────────────────────────────────────────────────
// constants/nodeStatus.ts — 节点执行状态视觉映射
//
// editing → 编辑中，无指示器，无特殊边框
// idle    → 未运行，(-) 指示器，白色/默认边框
// running → 执行中，(...) 指示器，闪烁绿色边框
// success → 成功，(√) 指示器，绿色边框
// failure → 失败，(×) 指示器，红色边框
// warning → 警告，(!) 指示器，黄色边框
// ─────────────────────────────────────────────────────────────

import type { NodeExecutionStatus } from '../types/workflow'

export interface NodeStatusStyle {
  /** 顶部右侧显示的状态图标字符 */
  icon: string
  /** 边框颜色（editing/idle 为空字符串表示不覆盖） */
  borderColor: string
  /** CSS 类名，用于 running 的闪烁动画 */
  animationClass: string
}

export const NODE_STATUS_STYLES: Record<NodeExecutionStatus, NodeStatusStyle> = {
  editing: {
    icon: '',
    borderColor: '',
    animationClass: ''
  },
  idle: {
    icon: '-',
    borderColor: '#6b7280',
    animationClass: ''
  },
  running: {
    icon: '...',
    borderColor: '#22c55e',
    animationClass: 'status-running'
  },
  success: {
    icon: '√',
    borderColor: '#22c55e',
    animationClass: ''
  },
  failure: {
    icon: '×',
    borderColor: '#ef4444',
    animationClass: ''
  },
  warning: {
    icon: '!',
    borderColor: '#eab308',
    animationClass: ''
  }
}
