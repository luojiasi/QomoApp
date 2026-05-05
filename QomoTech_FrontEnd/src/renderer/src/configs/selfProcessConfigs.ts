/** 节点运行状态颜色映射 */
export const NODE_STATUS_COLOR: Record<string, string> = {
  idle: '#7c3aed',
  running: '#facc15',
  success: '#16a34a',
  failed: '#dc2626',
  skipped: '#94a3b8'
}

/** 节点尺寸 */
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 80

/** 日志级别颜色 */
export const LOG_LEVEL_COLOR: Record<string, string> = {
  info: '#2563eb',
  warn: '#ca8a04',
  error: '#dc2626',
  debug: '#64748b'
}

/** 日志级别标签 */
export const LOG_LEVEL_LABEL: Record<string, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试'
}
