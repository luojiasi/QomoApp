import { ElectronAPI } from '@electron-toolkit/preload'
import type { LicenseActivationResult, LicenseStatus } from '../main/types/license'

export type SaveJsonResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }
export type OpenDocumentResult = { ok: true } | { ok: false; error: string }

export type SaveJsonPreset =
  | 'controller-settings'
  | 'main-recipe-details'

export type BackendRuntimeState = 'running' | 'starting' | 'restarting' | 'error' | 'missing' | 'stopped'

export type BackendRuntimeStatus = {
  state: BackendRuntimeState
  isReachable: boolean
  message: string
}

/** 目录条目 */
export type DirectoryEntry = {
  name: string
  isDirectory: boolean
  isFile: boolean
}

/** 文件操作结果 */
export type WorkflowFileResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

export type RendererApi = {
  license: {
    getStatus: () => Promise<LicenseStatus>
    activate: (licenseKey: string) => Promise<LicenseActivationResult>
    clear: () => Promise<LicenseStatus>
    getDeviceFingerprint: () => Promise<string>
  }
  getBackendRuntimeStatus: () => Promise<BackendRuntimeStatus>
  saveJsonToFile: (preset: SaveJsonPreset, content: string) => Promise<SaveJsonResult>
  openDocument: (relativePath: string) => Promise<OpenDocumentResult>

  // Workflow 文件操作
  getWorkflowsPath: () => Promise<string>
  readDirectory: (dirPath: string) => Promise<WorkflowFileResult>
  readFile: (filePath: string) => Promise<WorkflowFileResult>
  writeFile: (filePath: string, content: string) => Promise<WorkflowFileResult>
  deleteFile: (targetPath: string) => Promise<WorkflowFileResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApi
  }
}
