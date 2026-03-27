import { ElectronAPI } from '@electron-toolkit/preload'
import type { LicenseActivationResult, LicenseStatus } from '../main/types/license'

export type SaveJsonResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }

export type SaveJsonPreset =
  | 'controller-settings'
  | 'rs232-workbench'
  | 'main-recipe-details'

export type BackendRuntimeState = 'running' | 'starting' | 'restarting' | 'error' | 'missing' | 'stopped'

export type BackendRuntimeStatus = {
  state: BackendRuntimeState
  isReachable: boolean
  message: string
}

export type RendererApi = {
  license: {
    getStatus: () => Promise<LicenseStatus>
    activate: (licenseKey: string) => Promise<LicenseActivationResult>
    clear: () => Promise<LicenseStatus>
    getDeviceFingerprint: () => Promise<string>
  }
  getBackendRuntimeStatus: () => Promise<BackendRuntimeStatus>
  saveJsonToFile: (preset: SaveJsonPreset, content: string) => Promise<SaveJsonResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApi
  }
}
