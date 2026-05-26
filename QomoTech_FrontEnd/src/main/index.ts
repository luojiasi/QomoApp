import { type ChildProcess, exec, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  activateLicense,
  clearLicense,
  getCurrentDeviceFingerprint,
  getLicenseStatus,
} from './license'

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
  // /T: also kill child processes
  // /F: force
  await execAsync(`taskkill /PID ${pid} /F /T`)
}

const gracefulShutdownBackend = async (): Promise<void> => {
  // 先通过 HTTP 接口通知后端优雅关闭，让 Python 有机会刷日志、执行 cleanup。
  try {
    await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/shutdown`, {method: 'POST',signal: AbortSignal.timeout(3000)})
  } catch {
    // 后端已经挂了或者超时，继续走强杀兜底
  }
}

const stopPackagedBackend = async (): Promise<void> => {
  // 1) 先发优雅关闭请求，给后端 3s 写完日志的时间。
  await gracefulShutdownBackend()

  // 2) 等最多 4s 看后端是否自行退出，退出了就不用强杀。
  const selfExited = await waitForBackendStop(4000)
  if (selfExited) return

  // 3) 后端仍在运行，走强杀兜底。
  try {
    if (backendProcess && typeof backendProcess.pid === 'number') {
      if (backendProcess.exitCode == null) {
        backendProcess.kill()
      }
    }
  } catch {
    // ignore
  }

  // 4) 最后兜底：按端口找 PID 再强杀。
  try {
    const out = await execAsync(`netstat -ano | findstr :${BACKEND_PORT}`)
    // Example line:
    // TCP    0.0.0.0:5000   0.0.0.0:0   LISTENING   9688
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

const waitForBackendStop = async (timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await isBackendReachable())) return true
    await sleep(BACKEND_POLL_INTERVAL_MS)
  }
  return false
}

const shutdownWindowAfterBackendStopped = async (win: BrowserWindow): Promise<void> => {
  if (isShuttingDown) return
  isShuttingDown = true

  await stopPackagedBackend()
  await waitForBackendStop(BACKEND_STARTUP_WAIT_MS)

  // destroy is more deterministic than close when we already prevented the close event.
  try {
    win.destroy()
  } catch {
    // ignore
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

/** 打包环境尝试启动后端并记录运行时状态（用于渲染层展示） */
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

  // 短暂延迟，避免后端立即崩溃时无限重启循环
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

  const hasExecutable = app.isPackaged && !is.dev ? Boolean(await resolveBackendExecutablePath()) : true
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
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1920,
    minHeight: 1080,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'win32' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // 生产环境也打开 DevTools，便于排查打包后通信失败（“Failed to fetch”）。
    // 如需临时关闭：把这一段条件改为读取环境变量即可。
    // if (!is.dev) {
    //   try {
    //     if (!mainWindow.webContents.isDevToolsOpened()) {
    //       mainWindow.webContents.openDevTools({ mode: 'detach' })
    //     }
    //   } catch {
    //     // ignore
    //   }
    // }
  })

  // 处理用户直接关闭窗口（X按钮）时：先停掉 run.exe，再等待 5000 端口不可达，再销毁前端窗口。
  mainWindow.on('close', (event) => {
    // If we are already shutting down (triggered by IPC), don't block.
    if (isShuttingDown) return
    event.preventDefault()
    void shutdownWindowAfterBackendStopped(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    const reason = details.reason
    const exitCode = details.exitCode
    console.error(`[main] render-process-gone: reason=${reason}, exitCode=${exitCode}`)
    // 将崩溃原因写入文件，方便排查
    const crashLog = join(app.getPath('userData'), 'crash.log')
    const timestamp = new Date().toISOString()
    const crashMsg = `[${timestamp}] render-process-gone: reason=${reason}, exitCode=${exitCode}\n`
    void writeFile(crashLog, crashMsg, { flag: 'a' }).catch(() => {})
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const registerWindowControlIpc = (): void => {
  ipcMain.on('window-control', (event, action: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    if (!win) {
      return
    }

    if (action === 'close') {
      void shutdownWindowAfterBackendStopped(win)
      return
    }

    if (action === 'minimize') {
      win.minimize()
      return
    }

    if (action === 'maximize') {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })
}

const registerLicenseIpc = (): void => {
  ipcMain.handle('license:get-status', () => getLicenseStatus())
  ipcMain.handle('license:activate', (_, licenseKey: string) => activateLicense(licenseKey))
  ipcMain.handle('license:clear', () => clearLicense())
  ipcMain.handle('license:get-device-fingerprint', () => getCurrentDeviceFingerprint())
}

const registerBackendRuntimeStatusIpc = (): void => {
  ipcMain.handle('get-backend-runtime-status', () => getBackendRuntimeStatus())
}

type SaveJsonResult = { ok: true; filePath: string } | { ok: false; canceled: true } | { ok: false; error: string }

/** 与渲染层 `SaveJsonPreset` 保持一致，用于保存到本地 JSON 时的对话框配置 */
type SaveJsonPreset =
  | 'controller-settings'
  | 'rs232-workbench'
  | 'main-recipe-details'

const SAVE_JSON_DIALOG: Record<SaveJsonPreset, { title: string; defaultPath: string }> = {
  'controller-settings': {
    title: '保存控制器参数',
    defaultPath: 'controller-parameters.json'
  },
  'rs232-workbench': {
    title: '保存 RS232 工作台配置',
    defaultPath: 'rs232-workbench.json'
  },
  'main-recipe-details': {
    title: '保存主配方详情',
    defaultPath: 'main-recipe-details.json'
  }
}

const registerSaveJsonFileIpc = (): void => {
  ipcMain.handle(
    'app:save-json-file',
    async (_, preset: SaveJsonPreset, content: string): Promise<SaveJsonResult> => {
      try {
        const cfg = SAVE_JSON_DIALOG[preset]
        if (!cfg) {
          return { ok: false, error: `未知保存类型: ${String(preset)}` }
        }
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: cfg.title,
          defaultPath: cfg.defaultPath,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
        if (canceled || !filePath) {
          return { ok: false, canceled: true }
        }
        await writeFile(filePath, content, 'utf-8')
        return { ok: true, filePath }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: message }
      }
    }
  )
}

type OpenDocumentResult = { ok: true } | { ok: false; error: string }

const registerOpenDocumentIpc = (): void => {
  ipcMain.handle('app:open-document', async (_, relativePath: string): Promise<OpenDocumentResult> => {
    try {
      const safeRelativePath = String(relativePath || '').replace(/^[/\\]+/, '')
      if (!safeRelativePath) {
        return { ok: false, error: '文档路径不能为空' }
      }

      const candidates = [
        // 打包后 asar 解包目录（electron-builder asarUnpack）
        join(process.resourcesPath, 'app.asar.unpacked', safeRelativePath),
        // 打包后 resources 直出目录（某些构建/调试场景）
        join(process.resourcesPath, safeRelativePath),
        // 开发环境项目目录
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
        return { ok: false, error: `未找到文档: ${safeRelativePath}` }
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
  })
}

// ──── Workflow 文件操作 IPC ─────────────────────────────────────

type WorkflowFileResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

const getWorkflowsBasePath = (): string => {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'workflows')
  }
  return join(app.getAppPath(), 'src', 'renderer', 'workflows')
}

const registerWorkflowFileIpc = (): void => {
  ipcMain.handle('app:get-workflows-path', (): string => getWorkflowsBasePath())

  ipcMain.handle('app:read-directory', async (_, dirPath: string): Promise<WorkflowFileResult> => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const items = entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile()
      }))
      return { ok: true, data: items }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('app:read-file', async (_, filePath: string): Promise<WorkflowFileResult> => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return { ok: true, data: content }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('app:write-file', async (_, filePath: string, content: string): Promise<WorkflowFileResult> => {
    try {
      const dir = dirname(filePath)
      await mkdir(dir, { recursive: true })
      await writeFile(filePath, content, 'utf-8')
      return { ok: true, data: null }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('app:delete-file', async (_, targetPath: string): Promise<WorkflowFileResult> => {
    try {
      await rm(targetPath, { recursive: true, force: true })
      return { ok: true, data: null }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerWindowControlIpc()
  registerLicenseIpc()
  registerBackendRuntimeStatusIpc()
  registerSaveJsonFileIpc()
  registerOpenDocumentIpc()
  registerWorkflowFileIpc()
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

