// =============================================================================
// 自由编辑参数 —— 任务数据管理 + 文件持久化
// =============================================================================

import { reactive } from 'vue'
import type { TaskRow, SerializedTaskTable } from '../commons/freeParamTypes'
import { TASK_TABLE_VERSION, TASK_TABLE_FILE_EXT } from '../commons/freeParamTypes'
import { generateId } from '../utils/idgen'

/** 模块级单例状态 */
const rows = reactive<TaskRow[]>([])

/** 由"自由编辑参数"绘制的实体 ID 集合，供 Canvas2D 渲染时使用不同颜色 */
export const drawnEntityIds = new Set<string>()

function createRow(taskNo: number): TaskRow {
  return {
    id: generateId('task'),
    taskNo,
    diameter: 0,
    height: 0,
    divisions: 12,
    recipe: '',
  }
}

export function useFreeParamTask() {
  /** 初始化默认行 */
  function initDefault() {
    rows.length = 0
    rows.push(createRow(1))
  }

  /** 添加一行 */
  function addRow() {
    const nextNo = rows.length > 0 ? Math.max(...rows.map(r => r.taskNo)) + 1 : 1
    rows.push(createRow(nextNo))
  }

  /** 删除行 */
  function removeRow(id: string) {
    const idx = rows.findIndex(r => r.id === id)
    if (idx !== -1) rows.splice(idx, 1)
    // 重新编号
    rows.forEach((r, i) => (r.taskNo = i + 1))
  }

  /** 导出为 .qtask 文件（浏览器下载） */
  function exportToFile(fileName?: string) {
    const data: SerializedTaskTable = {
      format: 'QOMO5P-TaskTable',
      version: TASK_TABLE_VERSION,
      savedAt: new Date().toISOString(),
      rows: JSON.parse(JSON.stringify(rows)),
    }
    const json = JSON.stringify(data, null, 2)
    const name = fileName || `task_params${TASK_TABLE_FILE_EXT}`
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  /** 从文件内容加载 */
  function loadFromFile(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.format === 'QOMO5P-TaskTable' && Array.isArray(parsed.rows)) {
        rows.length = 0
        for (const r of parsed.rows) {
          rows.push({
            id: r.id || generateId('task'),
            taskNo: r.taskNo ?? 0,
            diameter: r.diameter ?? 0,
            height: r.height ?? 0,
            divisions: r.divisions ?? 12,
            recipe: r.recipe ?? '',
          })
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    taskRows: rows,
    initDefault,
    addRow,
    removeRow,
    exportToFile,
    loadFromFile,
  }
}
