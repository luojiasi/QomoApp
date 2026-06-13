import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  system: {
    getInfo: (): Promise<{
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
    }> => ipcRenderer.invoke('system:info')
  },
  update: {
    check: (): Promise<{ success: boolean; updateInfo?: unknown; error?: string }> =>
      ipcRenderer.invoke('update:check'),
    download: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('update:download'),
    install: (): void => {
      ipcRenderer.invoke('update:install')
    },
    onCheckingForUpdate: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('update:checking-for-update', handler)
      return () => ipcRenderer.removeListener('update:checking-for-update', handler)
    },
    onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
      const handler = (_event: unknown, info: unknown): void => callback(info)
      ipcRenderer.on('update:update-available', handler)
      return () => ipcRenderer.removeListener('update:update-available', handler)
    },
    onUpdateNotAvailable: (callback: (info: unknown) => void): (() => void) => {
      const handler = (_event: unknown, info: unknown): void => callback(info)
      ipcRenderer.on('update:update-not-available', handler)
      return () => ipcRenderer.removeListener('update:update-not-available', handler)
    },
    onDownloadProgress: (callback: (progress: unknown) => void): (() => void) => {
      const handler = (_event: unknown, progress: unknown): void => callback(progress)
      ipcRenderer.on('update:download-progress', handler)
      return () => ipcRenderer.removeListener('update:download-progress', handler)
    },
    onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
      const handler = (_event: unknown, info: unknown): void => callback(info)
      ipcRenderer.on('update:update-downloaded', handler)
      return () => ipcRenderer.removeListener('update:update-downloaded', handler)
    },
    onError: (callback: (error: string) => void): (() => void) => {
      const handler = (_event: unknown, error: string): void => callback(error)
      ipcRenderer.on('update:error', handler)
      return () => ipcRenderer.removeListener('update:error', handler)
    }
  }
}

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
