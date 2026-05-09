<template>
  <div class="ws-debug">
    <header>
      <h1>/ws/motion/status</h1>
      <span :class="['dot', dotClass]"></span>
      <span class="status-text">{{ stateText }}</span>
      <span class="count">收到 {{ messageCount }} 帧</span>
    </header>

    <div class="conn-bar">
      <label>
        Host
        <input
          v-model="hostInput"
          placeholder="127.0.0.1:5000"
          @keyup.enter="reconnect"
        />
      </label>
      <label>
        Path
        <input v-model="pathInput" @keyup.enter="reconnect" />
      </label>
      <label class="tls">
        <input v-model="useTls" type="checkbox" />
        wss
      </label>
      <button class="btn primary" @click="reconnect">连接</button>
      <button class="btn" @click="useDevProxy">用 Vite 代理</button>
    </div>

    <div class="conn-bar">
      <label>
        控制器 IP
        <input
          v-model="controllerIp"
          placeholder="192.168.0.11"
          @keyup.enter="connectController"
        />
      </label>
      <button class="btn primary" :disabled="ctlBusy" @click="connectController">
        连接控制器
      </button>
      <button class="btn" :disabled="ctlBusy" @click="disconnectController">
        断开控制器
      </button>
      <span v-if="ctlMessage" :class="['ctl-msg', ctlOk ? 'ok' : 'err']">
        {{ ctlMessage }}
      </span>
    </div>

    <div class="meta">
      <div><b>URL:</b> {{ wsUrl }}</div>
      <div><b>readyState:</b> {{ readyState }} ({{ stateText }})</div>
      <div v-if="lastError" class="err"><b>error:</b> {{ lastError }}</div>
      <div v-if="closeInfo" class="err"><b>closed:</b> {{ closeInfo }}</div>
    </div>

    <section v-if="snapshot" class="grid">
      <div class="card">
        <div class="card-title">基本</div>
        <div><b>state:</b> {{ snapshot.state }}</div>
        <div><b>timestamp:</b> {{ snapshot.timestamp }}</div>
        <div><b>error:</b> {{ snapshot.error ?? 'null' }}</div>
      </div>

      <div class="card">
        <div class="card-title">position (dpos)</div>
        <pre>{{ formatRecord(snapshot.position) }}</pre>
      </div>

      <div class="card">
        <div class="card-title">mposition (mpos)</div>
        <pre>{{ formatRecord(snapshot.mposition) }}</pre>
      </div>

      <div class="card">
        <div class="card-title">idle</div>
        <pre>{{ formatRecord(snapshot.idle) }}</pre>
      </div>

      <div class="card">
        <div class="card-title">alarms</div>
        <pre>{{ formatRecord(snapshot.alarms) }}</pre>
      </div>

      <div class="card">
        <div class="card-title">enabled</div>
        <pre>{{ formatRecord(snapshot.enabled) }}</pre>
      </div>

      <div class="card axes">
        <div class="card-title">axes</div>
        <table>
          <thead>
            <tr>
              <th>name</th>
              <th>id</th>
              <th>dpos</th>
              <th>mpos</th>
              <th>idle</th>
              <th>alarm</th>
              <th>enabled</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ax in snapshot.axes" :key="ax.axis_id">
              <td>{{ ax.name }}</td>
              <td>{{ ax.axis_id }}</td>
              <td>{{ ax.dpos }}</td>
              <td>{{ ax.mpos }}</td>
              <td>{{ ax.idle }}</td>
              <td>{{ ax.alarm_code }}</td>
              <td>{{ ax.enabled }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card raw">
        <div class="card-title">raw JSON</div>
        <pre>{{ rawJson }}</pre>
      </div>
    </section>

    <p v-else class="empty">等待第一帧数据...（如果一直在等，请检查后端是否启动 + 看上面的 readyState/error）</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface AxisSnapshot {
  name: string
  axis_id: number
  dpos: number
  mpos: number
  idle: boolean
  alarm_code: number
  enabled: boolean
}

interface MotionStatusSnapshot {
  state: string
  position: Record<string, number>
  mposition: Record<string, number>
  idle: Record<string, boolean>
  alarms: Record<string, number>
  enabled: Record<string, boolean>
  axes: AxisSnapshot[]
  timestamp: number
  error: string | null
}

const snapshot = ref<MotionStatusSnapshot | null>(null)
const messageCount = ref(0)
const readyState = ref<number>(WebSocket.CLOSED)
const lastError = ref<string>('')
const closeInfo = ref<string>('')

const STORAGE_KEY = 'wsDebug.config.v1'

interface PersistedConfig {
  host: string
  path: string
  useTls: boolean
}

const loadConfig = (): PersistedConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { host: '127.0.0.1:5000', path: '/ws/motion/status', useTls: false }
}

const initial = loadConfig()
const hostInput = ref(initial.host)
const pathInput = ref(initial.path)
const useTls = ref(initial.useTls)

const buildWsUrl = (): string => {
  const host = hostInput.value.trim() || '127.0.0.1:5000'
  let path = pathInput.value.trim() || '/ws/motion/status'
  if (!path.startsWith('/')) path = `/${path}`
  const proto = useTls.value ? 'wss:' : 'ws:'
  return `${proto}//${host}${path}`
}

const wsUrl = ref(buildWsUrl())

const persistConfig = (): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        host: hostInput.value,
        path: pathInput.value,
        useTls: useTls.value
      })
    )
  } catch {
    /* ignore */
  }
}

const useDevProxy = (): void => {
  hostInput.value = window.location.host
  pathInput.value = '/ws/motion/status'
  useTls.value = window.location.protocol === 'https:'
  reconnect()
}

const CTL_KEY = 'wsDebug.controllerIp.v1'
const controllerIp = ref<string>(localStorage.getItem(CTL_KEY) ?? '192.168.0.11')
const ctlMessage = ref<string>('')
const ctlOk = ref<boolean>(true)
const ctlBusy = ref<boolean>(false)

const httpBase = (): string => {
  const host = hostInput.value.trim() || '127.0.0.1:5000'
  const proto = useTls.value ? 'https:' : 'http:'
  return `${proto}//${host}`
}

const callMotion = async (
  endpoint: '/connect' | '/disconnect',
  body?: Record<string, unknown>
): Promise<void> => {
  ctlBusy.value = true
  ctlMessage.value = '请求中...'
  ctlOk.value = true
  try {
    const resp = await fetch(`${httpBase()}/api/motion${endpoint}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    })
    const text = await resp.text()
    let payload: any = text
    try {
      payload = JSON.parse(text)
    } catch {
      /* not json */
    }
    if (!resp.ok) {
      ctlOk.value = false
      ctlMessage.value = `${resp.status} ${resp.statusText}: ${
        payload?.detail ?? text
      }`
    } else {
      ctlOk.value = true
      ctlMessage.value = payload?.message ?? '成功'
    }
  } catch (e: any) {
    ctlOk.value = false
    ctlMessage.value = `网络错误: ${e?.message ?? String(e)}`
  } finally {
    ctlBusy.value = false
  }
}

const connectController = (): void => {
  const ip = controllerIp.value.trim()
  if (!ip) {
    ctlOk.value = false
    ctlMessage.value = '请输入控制器 IP'
    return
  }
  localStorage.setItem(CTL_KEY, ip)
  void callMotion('/connect', { ip })
}

const disconnectController = (): void => {
  void callMotion('/disconnect')
}

const stateText = computed(() => {
  switch (readyState.value) {
    case WebSocket.CONNECTING:
      return 'CONNECTING'
    case WebSocket.OPEN:
      return 'OPEN'
    case WebSocket.CLOSING:
      return 'CLOSING'
    default:
      return 'CLOSED'
  }
})

const dotClass = computed(() => {
  if (readyState.value === WebSocket.OPEN) return 'on'
  if (readyState.value === WebSocket.CONNECTING) return 'pending'
  return 'off'
})

const formatRecord = (r: Record<string, unknown> | undefined): string =>
  r ? JSON.stringify(r, null, 2) : '{}'

const rawJson = computed(() =>
  snapshot.value ? JSON.stringify(snapshot.value, null, 2) : ''
)

let ws: WebSocket | null = null

const connect = (): void => {
  if (ws) {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
    ws = null
  }
  lastError.value = ''
  closeInfo.value = ''
  wsUrl.value = buildWsUrl()
  readyState.value = WebSocket.CONNECTING

  try {
    ws = new WebSocket(wsUrl.value)
  } catch (e: any) {
    lastError.value = e?.message ?? String(e)
    readyState.value = WebSocket.CLOSED
    return
  }

  ws.onopen = () => {
    readyState.value = WebSocket.OPEN
  }
  ws.onmessage = (ev) => {
    try {
      snapshot.value = JSON.parse(ev.data)
      messageCount.value += 1
    } catch (e: any) {
      lastError.value = `parse: ${e?.message ?? String(e)}`
    }
  }
  ws.onerror = () => {
    lastError.value = 'WebSocket error（一般是连接失败/被拒绝，看 Console & Network）'
  }
  ws.onclose = (ev) => {
    readyState.value = WebSocket.CLOSED
    closeInfo.value = `code=${ev.code} reason="${ev.reason}" wasClean=${ev.wasClean}`
  }
}

function reconnect(): void {
  persistConfig()
  connect()
}

onMounted(() => {
  connect()
})

onBeforeUnmount(() => {
  if (ws) {
    ws.close()
    ws = null
  }
})
</script>

<style scoped>
.ws-debug {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 16px;
  color: #1f2937;
  background: #f9fafb;
  min-height: 100vh;
  box-sizing: border-box;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
h1 {
  font-size: 18px;
  margin: 0;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dot.on {
  background: #16a34a;
  box-shadow: 0 0 6px #16a34a;
}
.dot.pending {
  background: #f59e0b;
}
.dot.off {
  background: #9ca3af;
}
.status-text {
  font-size: 13px;
  color: #4b5563;
}
.count {
  margin-left: auto;
  font-size: 13px;
  color: #6b7280;
}
.btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.btn:hover {
  background: #f3f4f6;
}
.btn.primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.btn.primary:hover {
  background: #1d4ed8;
}
.conn-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 12px;
}
.conn-bar label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #374151;
}
.conn-bar input[type='text'],
.conn-bar input:not([type]) {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}
.conn-bar label:nth-of-type(1) input {
  width: 180px;
}
.conn-bar label:nth-of-type(2) input {
  width: 220px;
}
.conn-bar .tls {
  cursor: pointer;
}
.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.ctl-msg {
  font-size: 12px;
  margin-left: 4px;
}
.ctl-msg.ok {
  color: #15803d;
}
.ctl-msg.err {
  color: #b91c1c;
}
.meta {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  margin-bottom: 12px;
  line-height: 1.7;
  word-break: break-all;
}
.meta .err {
  color: #b91c1c;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
}
.card-title {
  font-weight: 600;
  font-size: 13px;
  color: #111827;
  margin-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 4px;
}
.card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.4;
}
.axes {
  grid-column: 1 / -1;
}
.axes table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.axes th,
.axes td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
}
.axes th {
  background: #f3f4f6;
}
.raw {
  grid-column: 1 / -1;
}
.raw pre {
  max-height: 240px;
  overflow: auto;
  background: #111827;
  color: #d1fae5;
  padding: 8px;
  border-radius: 4px;
}
.empty {
  color: #6b7280;
  font-size: 14px;
}
</style>
