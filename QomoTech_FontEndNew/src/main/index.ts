import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 720,
    title: '科猛碳极',
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Forward update events to renderer
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:update-available', info)
    // DO NOT auto-download — user must click the button in UpdateModal
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow.webContents.send('update:update-not-available', info)
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:update-downloaded', info)
  })

  autoUpdater.on('error', (error) => {
    mainWindow.webContents.send('update:error', error.message)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.qomotech')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: renderer queries system info
  ipcMain.handle('system:info', () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const bounds = win?.getBounds()
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      appId: 'com.qomotech.app',
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      platform: process.platform,
      arch: process.arch,
      windowWidth: bounds?.width ?? 0,
      windowHeight: bounds?.height ?? 0,
      updateUrl: 'http://localhost:3000'
    }
  })

  // IPC: renderer requests update check (check only, no auto-download)
  ipcMain.handle('update:check', async () => {
    try {
      autoUpdater.autoDownload = false
      const result = await autoUpdater.checkForUpdates()
      const updateInfo = result?.updateInfo ?? null
      // Compare versions: only return updateInfo if server version is strictly newer
      if (updateInfo && updateInfo.version) {
        const current = app.getVersion()
        if (updateInfo.version === current) {
          return { success: true, updateInfo: null }
        }
      }
      return { success: true, updateInfo }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC: renderer explicitly requests download (user clicked the button)
  ipcMain.handle('update:download', async () => {
    try {
      autoUpdater.autoDownload = false
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC: install update and restart
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
