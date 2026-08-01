import { type ChildProcess, exec, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

type OpenDocumentResult = { ok: true } | { ok: false; error: string }

const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 5000
const BACKEND_SOCKET_TIMEOUT_MS = 1000
const BACKEND_POLL_INTERVAL_MS = 500
const BACKEND_STARTUP_WAIT_MS = 10_000

type BackendRuntimeState = 'running' | 'starting' | 'restarting' | 'error' | 'missing' | 'stopped'

type BackendRuntimeStatus = {
  state: BackendRuntimeState
  isReachable: boolean
  message: string
}

let backendProcess: ChildProcess | null = null
let backendStartupIssue = ''
let isBackendAutoRestarting = false
let currentBackendExecutablePath = ''
let isShuttingDown = false

const isBackendReachable = (): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.createConnection({
      host: BACKEND_HOST,
      port: BACKEND_PORT
    })

    const finalize = (result: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }

    socket.once('connect', () => finalize(true))
    socket.once('error', () => finalize(false))
    socket.setTimeout(BACKEND_SOCKET_TIMEOUT_MS, () => finalize(false))
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForBackend = async (timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isBackendReachable()) {
      return true
    }
    await sleep(BACKEND_POLL_INTERVAL_MS)
  }
  return false
}

const waitForBackendStop = async (timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await isBackendReachable())) return true
    await sleep(BACKEND_POLL_INTERVAL_MS)
  }
  return false
}

const execAsync = async (command: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(command, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        return reject(err)
      }
      resolve(String(stdout || stderr || ''))
    })
  })

const killBackendByPid = async (pid: number): Promise<void> => {
  if (!pid || pid === process.pid) return
  await execAsync(`taskkill /PID ${pid} /F /T`)
}

const gracefulShutdownBackend = async (): Promise<void> => {
  try {
    await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000)
    })
  } catch {
    // ignore
  }
}

const stopPackagedBackend = async (): Promise<void> => {
  await gracefulShutdownBackend()

  const selfExited = await waitForBackendStop(4000)
  if (selfExited) return

  try {
    if (backendProcess && typeof backendProcess.pid === 'number') {
      if (backendProcess.exitCode == null) {
        backendProcess.kill()
      }
    }
  } catch {
    // ignore
  }

  try {
    const out = await execAsync(`netstat -ano | findstr :${BACKEND_PORT}`)
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const lastToken = lines[0]?.split(/\s+/).at(-1)
    const pid = lastToken ? Number(lastToken) : NaN
    if (Number.isFinite(pid)) {
      await killBackendByPid(pid)
    }
  } catch {
    // ignore
  }
}

const shutdownWindowAfterBackendStopped = async (win: BrowserWindow): Promise<void> => {
  if (isShuttingDown) return
  isShuttingDown = true

  if (app.isPackaged && !is.dev) {
    await stopPackagedBackend()
    await waitForBackendStop(BACKEND_STARTUP_WAIT_MS)
  }

  try {
    win.destroy()
  } catch {
    win.close()
  }
}

const resolveBackendExecutablePath = async (): Promise<string | null> => {
  const candidates = [
    join(dirname(process.execPath), 'run.exe'),
    join(dirname(process.execPath), 'resources', 'run.exe')
  ]

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.F_OK)
      return candidate
    } catch {
      // keep trying
    }
  }

  return null
}

const tryStartPackagedBackend = async (): Promise<void> => {
  if (!app.isPackaged || is.dev) {
    return
  }

  if (await isBackendReachable()) {
    backendStartupIssue = ''
    return
  }

  const backendExecutablePath = await resolveBackendExecutablePath()
  if (!backendExecutablePath) {
    backendStartupIssue = '未找到 run.exe（同级目录或 resources）'
    return
  }

  currentBackendExecutablePath = backendExecutablePath

  try {
    const spawnedProcess = spawn(backendExecutablePath, [], {
      cwd: dirname(backendExecutablePath),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })

    backendProcess = spawnedProcess
    backendStartupIssue = ''

    spawnedProcess.once('error', (error) => {
      backendStartupIssue = `启动 run.exe 失败: ${error.message}`
    })

    spawnedProcess.once('exit', (code, signal) => {
      backendProcess = null
      if (isBackendAutoRestarting) {
        return
      }
      if (code !== 0 || signal) {
        backendStartupIssue = `run.exe 异常退出（code=${String(code)}, signal=${String(signal)}）`
        void autoRestartBackend()
      }
    })

    spawnedProcess.unref()

    const started = await waitForBackend(BACKEND_STARTUP_WAIT_MS)
    if (!started) {
      backendStartupIssue = `启动后端超时（${BACKEND_STARTUP_WAIT_MS}ms）`
    }
  } catch (error) {
    backendStartupIssue =
      error instanceof Error ? `启动 run.exe 失败: ${error.message}` : `启动 run.exe 失败: ${String(error)}`
  }
}

const autoRestartBackend = async (): Promise<void> => {
  if (isBackendAutoRestarting) {
    return
  }

  isBackendAutoRestarting = true
  console.warn('[backend] 检测到后端异常退出，3 秒后自动重启...')

  await sleep(3000)

  try {
    await tryStartPackagedBackend()
    if (await isBackendReachable()) {
      console.info('[backend] 后端自动重启成功')
    }
  } catch (err) {
    console.error(`[backend] 自动重启失败: ${String(err)}`)
  } finally {
    isBackendAutoRestarting = false
  }
}

const getBackendRuntimeStatus = async (): Promise<BackendRuntimeStatus> => {
  if (await isBackendReachable()) {
    return {
      state: 'running',
      isReachable: true,
      message: '后台已连接'
    }
  }

  const hasExecutable =
    app.isPackaged && !is.dev ? Boolean(await resolveBackendExecutablePath()) : true
  if (!hasExecutable) {
    return {
      state: 'missing',
      isReachable: false,
      message: '未找到 run.exe'
    }
  }

  if (isBackendAutoRestarting) {
    return {
      state: 'restarting',
      isReachable: false,
      message: '后台重启中'
    }
  }

  if (backendProcess) {
    return {
      state: 'starting',
      isReachable: false,
      message: backendStartupIssue || '后台启动中'
    }
  }

  if (backendStartupIssue) {
    return {
      state: 'error',
      isReachable: false,
      message: backendStartupIssue
    }
  }

  return {
    state: 'stopped',
    isReachable: false,
    message: currentBackendExecutablePath ? '后台未运行' : '后台未启动'
  }
}

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

  mainWindow.on('close', (event) => {
    if (isShuttingDown) return
    if (!(app.isPackaged && !is.dev)) return
    event.preventDefault()
    void shutdownWindowAfterBackendStopped(mainWindow)
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

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:update-available', info)
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

  ipcMain.handle('get-backend-runtime-status', () => getBackendRuntimeStatus())

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

  ipcMain.handle('update:check', async () => {
    try {
      autoUpdater.autoDownload = false
      const result = await autoUpdater.checkForUpdates()
      const updateInfo = result?.updateInfo ?? null
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

  ipcMain.handle('update:download', async () => {
    try {
      autoUpdater.autoDownload = false
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle(
    'app:open-document',
    async (_: unknown, relativePath: string): Promise<OpenDocumentResult> => {
      try {
        const safeRelativePath = String(relativePath || '').replace(/^[/\\]+/, '')
        if (!safeRelativePath) {
          return { ok: false, error: 'path empty' }
        }

        const candidates = [
          join(process.resourcesPath, 'app.asar.unpacked', safeRelativePath),
          join(process.resourcesPath, safeRelativePath),
          join(app.getAppPath(), safeRelativePath),
          join(app.getAppPath(), '..', safeRelativePath),
          join(process.cwd(), safeRelativePath)
        ]

        let targetPath = candidates[0]
        let found = false
        for (const p of candidates) {
          try {
            await access(p, constants.F_OK)
            targetPath = p
            found = true
            break
          } catch {
            // try next
          }
        }

        if (!found) {
          return { ok: false, error: `not found: ${safeRelativePath}` }
        }

        const openError = await shell.openPath(targetPath)
        if (openError) {
          return { ok: false, error: openError }
        }
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e)
        }
      }
    }
  )

  void tryStartPackagedBackend()
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
