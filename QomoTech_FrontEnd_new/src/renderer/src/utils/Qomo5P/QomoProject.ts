import type { QomoProjectData, QomoSerializedProject } from '@renderer/types/Qomo5P'

export const QOMO_PROJECT_FORMAT = 'QOMO-Project'
export const QOMO_PROJECT_VERSION = '1.0.0'

export const serializeQomoProject = (data: QomoProjectData): QomoSerializedProject => ({
  format: QOMO_PROJECT_FORMAT,
  version: QOMO_PROJECT_VERSION,
  savedAt: new Date().toISOString(),
  data: {
    ...data,
    meta: {
      ...data.meta,
      updatedAt: new Date().toISOString()
    }
  }
})


export const parseQomoProject = (text: string): QomoSerializedProject => {
  const project = JSON.parse(text) as QomoSerializedProject

  if (project?.format !== QOMO_PROJECT_FORMAT || !project?.data) {
    throw new Error('不是有效的 QOMO 工程文件')
  }

  return project
}

export const downloadTextFile = (fileName: string, text: string, mimeType = 'application/json') => {
  const finalFileName = fileName.endsWith('.ljs') ? fileName : `${fileName}.ljs`;
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = finalFileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
