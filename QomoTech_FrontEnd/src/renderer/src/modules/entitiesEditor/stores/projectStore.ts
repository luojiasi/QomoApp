// =============================================================================
// 项目持久化 —— localStorage 自动保存 + .ljs 文件导出
// =============================================================================

import type {SerializedProject,SurfaceEntity,EditorEntity} from '../commons/types'
import type { ExportEntity } from '../utils/entityNodes'
import { sortLinesAndAttachNodeForExport } from '../utils/entityNodes'
import { useEditorStore } from './editorStore'
import { STORAGE_KEY_PROJECT, PROJECT_VERSION } from '../configs/defaults'

/** 将当前 store 状态序列化并写入 localStorage */
export function saveProject() {
  const store = useEditorStore()
  const entitiesWithNodes: ExportEntity[] = sortLinesAndAttachNodeForExport(store.entities)
  const data: SerializedProject = {
    format: 'QOMO5P-Project',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    data: {
      meta: { ...store.projectMeta },
      layers: store.layers.map(l => ({ ...l })),
      entities: entitiesWithNodes as unknown as SurfaceEntity[],
    },
  }
  localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(data))
  store.clearDirty()
}

/** 从 localStorage 读取项目数据，不存在或解析失败返回 null */
export function loadProject(): SerializedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECT)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.format === 'QOMO5P-Project' && parsed.data) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * 页面初始化时调用：从 localStorage 恢复项目数据到 store。
 * 有数据返回 true，无数据返回 false（外部可继续初始化快捷键等）。
 */
export function loadProjectIntoStore(): boolean {
  const data = loadProject()
  if (!data) return false

  const store = useEditorStore()
  store.replaceAllEntities(
    data.data.entities as SurfaceEntity<EditorEntity>[],
    data.data.layers,
    data.data.meta,
  )
  // 清空初始加载产生的撤销栈
  while (store.undoStack.length > 0) store.undoStack.pop()
  while (store.redoStack.length > 0) store.redoStack.pop()
  store.clearDirty()
  return true
}

/** 导出为 .ljs 文件（浏览器下载） */
export function exportProject() {
  const store = useEditorStore()
  const entitiesWithNodes: ExportEntity[] = sortLinesAndAttachNodeForExport(store.entities)
  const data: SerializedProject = {
    format: 'QOMO5P-Project',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    data: {
      meta: { ...store.projectMeta },
      layers: store.layers.map(l => ({ ...l })),
      entities: entitiesWithNodes as unknown as SurfaceEntity[],
    },
  }
  const json = JSON.stringify(data, null, 2)
  const fileName = `${store.projectMeta.name || 'project'}.ljs`
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** 清除 localStorage 中保存的项目 */
export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY_PROJECT)
}
