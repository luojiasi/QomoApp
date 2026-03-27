import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LicenseActivationResult, LicenseStatus } from '../main/types/license'

type SaveJsonResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }

type BackendRuntimeState = 'running' | 'starting' | 'restarting' | 'error' | 'missing' | 'stopped'

type BackendRuntimeStatus = {
  state: BackendRuntimeState
  isReachable: boolean
  message: string
}

/** 与主进程 `app:save-json-file` 约定一致 */
export type SaveJsonPreset =
  | 'controller-settings'
  | 'rs232-workbench'
  | 'main-recipe-details'

type RendererApi = {
  license: {
    getStatus: () => Promise<LicenseStatus>
    activate: (licenseKey: string) => Promise<LicenseActivationResult>
    clear: () => Promise<LicenseStatus>
    getDeviceFingerprint: () => Promise<string>
  }
  getBackendRuntimeStatus: () => Promise<BackendRuntimeStatus>
  /** 保存 JSON 到本地文件（统一入口，由 preset 区分对话框/默认文件名） */
  saveJsonToFile: (preset: SaveJsonPreset, content: string) => Promise<SaveJsonResult>
}

const api: RendererApi = {
  license: {
    getStatus: () => ipcRenderer.invoke('license:get-status'),
    activate: (licenseKey: string) => ipcRenderer.invoke('license:activate', licenseKey),
    clear: () => ipcRenderer.invoke('license:clear'),
    getDeviceFingerprint: () => ipcRenderer.invoke('license:get-device-fingerprint')
  },
  getBackendRuntimeStatus: () => ipcRenderer.invoke('get-backend-runtime-status'),
  saveJsonToFile: (preset: SaveJsonPreset, content: string) =>
    ipcRenderer.invoke('app:save-json-file', preset, content)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
