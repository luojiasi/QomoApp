import { ElectronAPI } from '@electron-toolkit/preload'

interface SystemInfo {
  appName: string
  appVersion: string
  appId: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  windowWidth: number
  windowHeight: number
  updateUrl: string
}

interface UpdateAPI {
  check: () => Promise<{ success: boolean; updateInfo?: unknown; error?: string }>
  download: () => Promise<{ success: boolean; error?: string }>
  install: () => void
  onCheckingForUpdate: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void
  onUpdateNotAvailable: (callback: (info: unknown) => void) => () => void
  onDownloadProgress: (callback: (progress: unknown) => void) => () => void
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      system: {
        getInfo: () => Promise<SystemInfo>
      }
      update: UpdateAPI
    }
  }
}
