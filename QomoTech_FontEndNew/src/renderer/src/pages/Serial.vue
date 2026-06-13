<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useL10n } from '../shared/l10n'
import {
  openRs232,
  closeRs232,
  sendRs232,
  fetchRs232Ports,
  fetchRs232Buffer,
  type Rs232PortInfo,
  type Rs232SendRequest,
  type Rs232SerialSessionRequest,
  defaultRs232WorkbenchState
} from '../shared/serial'

const { t } = useL10n()

interface TerminalEntry {
  time: string
  type: 'system' | 'tx' | 'rx'
  message: string
}

const RS232_COM_FALLBACK = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10']

const terminalLog = ref<TerminalEntry[]>([])
const isConnected = ref(false)
const isConnecting = ref(false)
const displayMode = ref<'HEX' | 'ASCII'>('ASCII')
const cmdInput = ref('')
const portsFromApi = ref<Rs232PortInfo[]>([])

const config = ref({ ...defaultRs232WorkbenchState })

const portNameOptions = computed(() => {
  if (portsFromApi.value.length > 0) {
    return portsFromApi.value.map((p) => p.device).filter(Boolean)
  }
  return [...RS232_COM_FALLBACK]
})

let pollTimer: ReturnType<typeof setInterval> | null = null

function log(type: TerminalEntry['type'], message: string): void {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`
  terminalLog.value.push({ time, type, message })
  if (terminalLog.value.length > 1000) {
    terminalLog.value.shift()
  }
}

function clearConsole(): void {
  terminalLog.value = []
}

async function loadPorts(): Promise<void> {
  try {
    const res = await fetchRs232Ports()
    if (res.success && res.data?.ports) {
      portsFromApi.value = res.data.ports
      const currentInList = portNameOptions.value.includes(config.value.port.portName)
      if (!currentInList && portsFromApi.value.length > 0) {
        config.value.port.portName = portsFromApi.value[0].device as typeof config.value.port.portName
      }
    }
  } catch {
    // backend unreachable — portNameOptions always has COM1-COM10 fallback
  }
}

async function toggleConnection(): Promise<void> {
  if (isConnected.value) {
    await disconnectPort()
  } else {
    await connectPort()
  }
}

async function connectPort(): Promise<void> {
  if (isConnecting.value || isConnected.value) return
  isConnecting.value = true
  try {
    const session: Rs232SerialSessionRequest = {
      port: { ...config.value.port },
      receive: { ...config.value.receive },
      send: { ...config.value.send }
    }
    const res = await openRs232(session)
    if (res.success) {
      isConnected.value = true
      log('system', t('serial.logConnected'))
      startPolling()
    } else {
      log('system', `${t('serial.logConnectFailed')}: ${res.message ?? ''}`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // "Failed to fetch" means CSP blocked or backend down —  already handled silently per polling
    if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError')) {
      log('system', `${t('serial.logBackendUnreachable')}: ${msg}`)
    }
  } finally {
    isConnecting.value = false
  }
}

async function disconnectPort(): Promise<void> {
  stopPolling()
  try {
    const res = await closeRs232()
    isConnected.value = false
    if (res.success) {
      log('system', t('serial.logDisconnected'))
    }
  } catch {
    isConnected.value = false
  }
}

function startPolling(): void {
  stopPolling()
  // 首次清空后端缓冲区，后续每次轮询也清空，确保只获取增量数据
  fetchRs232Buffer(true).catch(() => {})

  pollTimer = setInterval(async () => {
    const res = await fetchRs232Buffer(true)
    if (res.success && res.data && typeof res.data.text === 'string') {
      const text = res.data.text.trim()
      if (!text) return
      const lines = text.split('\n').filter(Boolean)
      for (const line of lines) {
        log('rx', line)
      }
    }
  }, 250)
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function sendCommand(): Promise<void> {
  const payload = cmdInput.value.trim()
  if (!payload) return
  const request: Rs232SendRequest = {
    port: { ...config.value.port },
    send: { ...config.value.send, payload }
  }
  const res = await sendRs232(request)
  if (res.success) {
    log('tx', `TX >> ${payload}`)
    cmdInput.value = ''
  } else {
    log('system', `${t('serial.logSendFailed')}: ${res.message ?? ''}`)
  }
}

let portScanTimer: ReturnType<typeof setInterval> | null = null

function startPortScan(): void {
  stopPortScan()
  portScanTimer = setInterval(() => { void loadPorts() }, 3000)
}

function stopPortScan(): void {
  if (portScanTimer !== null) {
    clearInterval(portScanTimer)
    portScanTimer = null
  }
}

watch(isConnected, (connected) => {
  if (connected) { stopPortScan() } else { startPortScan() }
})

onMounted(() => {
  loadPorts()
  startPortScan()
})
</script>

<template>
  <div class="serial-page">
    <div class="serial-grid">
      <div class="serial-config">
        <div class="config-card">
          <div class="config-header">
            <h2 class="config-title">
              <span class="material-symbols-outlined text-primary">settings_ethernet</span>
              {{ t('serial.rs232Settings') }}
            </h2>
            <div class="link-status">
              <span class="link-label">{{ t('serial.linkStatus') }}:</span>
              <span class="link-dot" :class="{ connected: isConnected }"></span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('serial.comPort') }}</label>
            <div class="select-wrap">
              <select v-model="config.port.portName" class="form-select">
                <option v-for="p in portNameOptions" :key="p" :value="p">{{ p }}</option>
              </select>
              <span class="material-symbols-outlined select-arrow">expand_more</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ t('serial.baudRate') }}</label>
              <div class="select-wrap">
                <select v-model.number="config.port.baudRate" class="form-select">
                  <option :value="9600">9600</option>
                  <option :value="19200">19200</option>
                  <option :value="38400">38400</option>
                  <option :value="57600">57600</option>
                  <option :value="115200">115200</option>
                  <option :value="921600">921600</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('serial.dataBits') }}</label>
              <div class="select-wrap">
                <select v-model.number="config.port.dataBits" class="form-select">
                  <option :value="7">7</option>
                  <option :value="8">8</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ t('serial.stopBits') }}</label>
              <div class="select-wrap">
                <select v-model.number="config.port.stopBits" class="form-select">
                  <option :value="1">1</option>
                  <option :value="1.5">1.5</option>
                  <option :value="2">2</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('serial.parity') }}</label>
              <div class="select-wrap">
                <select v-model="config.port.parity" class="form-select">
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                  <option value="mark">Mark</option>
                  <option value="space">Space</option>
                </select>
                <span class="material-symbols-outlined select-arrow">expand_more</span>
              </div>
            </div>
          </div>

          <div class="connect-section">
            <button
              class="connect-btn"
              :class="{ connected: isConnected }"
              :disabled="isConnecting"
              @click="toggleConnection"
            >
              <span class="material-symbols-outlined spin" v-if="isConnecting">sync</span>
              <span class="material-symbols-outlined" v-else>{{ isConnected ? 'link_off' : 'link' }}</span>
              {{ isConnected ? t('serial.disconnect') : t('serial.connect') }}
            </button>
            <p class="connect-status">
              {{ isConnected
                ? `${t('serial.connected')} - ${(config.port.baudRate / 1000).toFixed(1)}kbps`
                : `${t('serial.disconnected')} - 0.00kbps` }}
            </p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">{{ t('serial.txPackets') }}</p>
            <p class="stat-value text-primary">{{ terminalLog.filter((e) => e.type === 'tx').length }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">{{ t('serial.rxPackets') }}</p>
            <p class="stat-value text-tertiary">{{ terminalLog.filter((e) => e.type === 'rx').length }}</p>
          </div>
        </div>
      </div>

      <div class="terminal-card">
        <div class="terminal-header">
          <div class="terminal-header-left">
            <span class="material-symbols-outlined terminal-icon">terminal</span>
            <span class="terminal-title">{{ t('serial.realTimeMonitor') }}</span>
          </div>
          <div class="terminal-header-right">
            <div class="mode-toggle">
              <button class="mode-btn" :class="{ active: displayMode === 'HEX' }" @click="displayMode = 'HEX'">HEX</button>
              <button class="mode-btn" :class="{ active: displayMode === 'ASCII' }" @click="displayMode = 'ASCII'">ASCII</button>
            </div>
            <button class="clear-btn" @click="clearConsole">
              <span class="material-symbols-outlined">delete_sweep</span>
            </button>
          </div>
        </div>

        <div class="terminal-log">
          <div v-for="(entry, idx) in terminalLog" :key="idx" class="terminal-entry" :class="`entry-${entry.type}`">
            <span class="entry-time">[{{ entry.time }}]</span>
            <span class="entry-msg">{{ entry.message }}</span>
          </div>
          <div v-if="terminalLog.length === 0" class="terminal-empty">
            {{ isConnected ? t('serial.awaitingData') : t('serial.notConnected') }}
          </div>
        </div>

        <div class="terminal-input-area">
          <div class="input-row">
            <div class="input-wrap">
              <input v-model="cmdInput" type="text" class="cmd-input" :placeholder="t('serial.enterCommand')" @keydown.enter="sendCommand" />
            </div>
            <button class="send-btn" @click="sendCommand">
              <span>{{ t('serial.send') }}</span>
              <span class="material-symbols-outlined">send</span>
            </button>
          </div>
          <div class="input-options">
            <label class="checkbox-label">
              <input v-model="config.receive.autoScroll" type="checkbox" />
              <span>{{ t('serial.autoScroll') }}</span>
            </label>
            <label class="checkbox-label">
              <input v-model="config.receive.showTimestamp" type="checkbox" />
              <span>{{ t('serial.timestamp') }}</span>
            </label>
            <label class="checkbox-label">
              <input v-model="config.send.appendCr" type="checkbox" />
              <span>{{ t('serial.crlf') }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.serial-page { display: flex; flex: 1; overflow: hidden; padding: 24px; }
.serial-grid { display: grid; grid-template-columns: 380px 1fr; gap: 24px; flex: 1; overflow: hidden; }
.serial-config { display: flex; flex-direction: column; gap: 16px; }
.config-card { background: rgba(36,39,42,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 24px; }
.config-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-outline-variant); padding-bottom: 16px; margin-bottom: 16px; }
.config-title { font-family: 'Inter',sans-serif; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--color-on-surface); }
.text-primary { color: var(--color-primary); }
.link-status { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface-variant); }
.link-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--color-error-container); border: 1px solid var(--color-error); }
.link-dot.connected { background: var(--color-primary-container); border-color: var(--color-primary); animation: status-pulse 2s infinite ease-in-out; }
@keyframes status-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.2); } }
.form-group { margin-bottom: 12px; }
.form-label { font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface-variant); text-transform: uppercase; display: block; margin-bottom: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.select-wrap { position: relative; }
.form-select { width: 100%; background: var(--color-surface-container-highest); border: 1px solid var(--color-outline-variant); border-radius: 4px; padding: 8px 16px; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface); appearance: none; -webkit-appearance: none; cursor: pointer; }
.form-select:focus { outline: none; border-color: var(--color-primary); }
.select-arrow { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--color-on-surface-variant); font-size: 16px; }
.connect-section { padding-top: 16px; border-top: 1px solid var(--color-outline-variant); }
.connect-btn { width: 100%; padding: 16px; border: none; border-radius: 4px; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; background: var(--color-primary); color: var(--color-on-primary); }
.connect-btn:hover { opacity: 0.9; }
.connect-btn:active { transform: scale(0.95); }
.connect-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.connect-btn.connected { background: var(--color-error-container); color: var(--color-on-error-container); }
.connect-status { text-align: center; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface-variant); margin-top: 8px; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { background: var(--color-surface-container); padding: 8px; border-radius: 4px; border: 1px solid var(--color-outline-variant); }
.stat-label { font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface-variant); }
.stat-value { font-family: 'JetBrains Mono',monospace; font-size: 20px; font-weight: 600; }
.text-tertiary { color: var(--color-tertiary); }
.terminal-card { background: rgba(36,39,42,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.terminal-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: var(--color-surface-container); border-bottom: 1px solid var(--color-outline-variant); }
.terminal-header-left { display: flex; align-items: center; gap: 16px; }
.terminal-icon { color: var(--color-on-surface-variant); }
.terminal-title { font-family: 'JetBrains Mono',monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; }
.terminal-header-right { display: flex; align-items: center; gap: 8px; }
.mode-toggle { display: flex; background: var(--color-surface-container-highest); border-radius: 4px; border: 1px solid var(--color-outline-variant); overflow: hidden; }
.mode-btn { padding: 2px 16px; border: none; font-family: 'JetBrains Mono',monospace; font-size: 12px; font-weight: 700; cursor: pointer; background: none; color: var(--color-on-surface-variant); }
.mode-btn.active { background: var(--color-primary); color: var(--color-on-primary); }
.clear-btn { padding: 4px; background: none; border: none; color: var(--color-on-surface-variant); cursor: pointer; }
.clear-btn:hover { color: var(--color-error); }
.terminal-log { flex: 1; overflow-y: auto; padding: 16px; background: var(--color-surface-container-lowest); font-family: 'JetBrains Mono',monospace; font-size: 12px; }
.terminal-log::-webkit-scrollbar { width: 6px; }
.terminal-log::-webkit-scrollbar-track { background: var(--color-surface-container-low); }
.terminal-log::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }
.terminal-entry { display: flex; gap: 16px; margin-bottom: 4px; }
.terminal-entry.entry-system { color: var(--color-on-surface-variant); opacity: 0.5; }
.terminal-entry.entry-tx { color: var(--color-primary); font-weight: 700; }
.terminal-entry.entry-rx { color: var(--color-tertiary); font-weight: 700; }
.entry-time { width: 96px; flex-shrink: 0; }
.entry-msg { font-weight: 700; }
.terminal-empty { color: var(--color-on-surface-variant); opacity: 0.4; text-align: center; padding: 32px 0; font-style: italic; }
.terminal-input-area { padding: 16px; background: var(--color-surface-container); border-top: 1px solid var(--color-outline-variant); }
.input-row { display: flex; gap: 16px; }
.input-wrap { flex: 1; }
.cmd-input { width: 100%; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: 4px; padding: 16px; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface); }
.cmd-input:focus { outline: none; border-color: var(--color-primary); }
.send-btn { padding: 0 24px; background: var(--color-primary); color: var(--color-on-primary); border: none; border-radius: 4px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: opacity 0.2s,transform 0.1s; }
.send-btn:hover { opacity: 0.9; }
.send-btn:active { transform: scale(0.95); }
.input-options { display: flex; gap: 16px; margin-top: 16px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: var(--color-on-surface-variant); }
.checkbox-label input { width: 16px; height: 16px; accent-color: var(--color-primary); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
