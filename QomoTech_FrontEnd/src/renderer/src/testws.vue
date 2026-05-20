<template>
  <div class="ws-debug">
    <header>
      <h1>api/hardware.ts — WS 硬件状态监控</h1>
    </header>

    <!-- 模块状态 -->
    <div class="conn-bar">
      <span class="badge" :class="wsDotClass">WS {{ wsText }}</span>
      <span class="badge" :class="ctrlDotClass">控制器 {{ ctrlText }}</span>
      <span class="badge" :class="camDotClass">相机 {{ camText }}</span>
      <span class="count">已接收 {{ state.messageCount.value }} 帧</span>
      <span v-if="state.lastError.value" class="err">错误: {{ state.lastError.value }}</span>
    </div>

        <!-- 相机画面 -->
    <div class="camera-section">
      <div class="card camera-card">
        <div class="card-title">
          相机画面
          <span class="cam-rec" :class="{ on: camState.connected.value }">●</span>
          <span v-if="camState.lastError.value" class="err">错误: {{ camState.lastError.value }}</span>
        </div>
        <img
          v-if="camState.frameUrl.value"
          :src="camState.frameUrl.value"
          alt="camera stream"
          class="camera-img"
        />
        <p v-else class="muted">等待相机画面...</p>
      </div>
    </div>

    <!-- 操作 -->
    <div class="conn-bar">
      <label>
        控制器 IP
        <input v-model="controllerIp" placeholder="192.168.0.11" @keyup.enter="connectController" />
      </label>
      <button class="btn primary" :disabled="ctlBusy" @click="connectController">连接控制器</button>
      <button class="btn" :disabled="ctlBusy" @click="disconnectController">断开控制器</button>
      <span v-if="ctlMessage" :class="['ctl-msg', ctlOk ? 'ok' : 'err']">{{ ctlMessage }}</span>
    </div>

    <!-- 基本信息 -->
    <section class="grid">
      <div class="card">
        <div class="card-title">控制器状态</div>
        <div><b>state:</b> {{ state.controllerState.value }}</div>
        <div><b>connected:</b> {{ state.controllerConnected.value }}</div>
      </div>

      <div class="card">
        <div class="card-title">WS 连接</div>
        <div><b>connected:</b> {{ state.wsConnected.value }}</div>
        <div><b>lastError:</b> {{ state.lastError.value || 'null' }}</div>
        <div><b>messageCount:</b> {{ state.messageCount.value }}</div>
      </div>

      <div class="card">
        <div class="card-title">相机状态 (cameraReceiver)</div>
        <div><b>connected:</b> {{ state.cameraConnected.value }}</div>
      </div>
    </section>

    <!-- position (dpos) -->
    <section class="grid">
      <div class="card">
        <div class="card-title">position (dpos)</div>
        <pre>{{ formatRecord(state.position.value) }}</pre>
      </div>

      <div class="card">
        <div class="card-title">mposition (mpos)</div>
        <pre>{{ formatRecord(state.mposition.value) }}</pre>
      </div>
    </section>

    <!-- 轴表格 -->
    <section>
      <div class="card axes">
        <div class="card-title">axes ({{ state.axes.value.length }} 轴)</div>
        <table v-if="state.axes.value.length">
          <thead>
            <tr>
              <th>name</th>
              <th>axis_no</th>
              <th>dpos</th>
              <th>mpos</th>
              <th>idle</th>
              <th>alarm_code</th>
              <th>enabled</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ax in state.axes.value" :key="ax.axis_no">
              <td>{{ ax.name }}</td>
              <td>{{ ax.axis_no }}</td>
              <td>{{ ax.dpos }}</td>
              <td>{{ ax.mpos }}</td>
              <td>{{ ax.idle }}</td>
              <td>{{ ax.alarm_code }}</td>
              <td>{{ ax.enabled }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">暂无轴数据</p>
      </div>
    </section>

    <!-- 原始 JSON -->
    <section>
      <div class="card raw">
        <div class="card-title">原始 JSON</div>
        <pre>{{ rawJson }}</pre>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHardwareState } from '@/shared/api/hardware'
import { useGlobalCameraReceiverState } from '@/modules/camera/composables/useCameraReceiver'
import { getBackendApiUrl } from '@/shared/api/httpClient'

const state = useHardwareState()
const camState = useGlobalCameraReceiverState()

const wsDotClass = computed(() =>
  state.wsConnected.value ? 'on' : state.lastError.value ? 'off' : 'pending'
)
const wsText = computed(() =>
  state.wsConnected.value ? '已连接' : state.lastError.value ? '断开' : '等待'
)
const ctrlDotClass = computed(() =>
  state.controllerConnected.value ? 'on' : 'off'
)
const ctrlText = computed(() =>
  state.controllerConnected.value ? '已连接' : state.controllerState.value === 'DISCONNECTED' ? '未连接' : state.controllerState.value
)
const camDotClass = computed(() =>
  state.cameraConnected.value ? 'on' : 'off'
)
const camText = computed(() =>
  state.cameraConnected.value ? '已连接' : '未连接'
)

const formatRecord = (r: Record<string, unknown>): string =>
  Object.keys(r).length ? JSON.stringify(r, null, 2) : '{}'

const rawJson = computed(() => {
  const obj = {
    controllerState: state.controllerState.value,
    controllerConnected: state.controllerConnected.value,
    wsConnected: state.wsConnected.value,
    messageCount: state.messageCount.value,
    lastError: state.lastError.value,
    position: state.position.value,
    mposition: state.mposition.value,
    axes: state.axes.value,
    cameraConnected: state.cameraConnected.value,
  }
  return JSON.stringify(obj, null, 2)
})

// 控制器连接/断开
const controllerIp = ref(localStorage.getItem('wsDebug.controllerIp') ?? '192.168.0.11')
const ctlMessage = ref('')
const ctlOk = ref(true)
const ctlBusy = ref(false)

async function callMotion(endpoint: '/connect' | '/disconnect', body?: Record<string, unknown>): Promise<void> {
  ctlBusy.value = true
  ctlMessage.value = '请求中...'
  ctlOk.value = true
  try {
    const resp = await fetch(`${getBackendApiUrl('motion' + endpoint)}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await resp.text()
    let payload: any = text
    try { payload = JSON.parse(text) } catch { /* not json */ }
    if (!resp.ok) {
      ctlOk.value = false
      ctlMessage.value = `${resp.status}: ${payload?.detail ?? text}`
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

function connectController(): void {
  const ip = controllerIp.value.trim()
  if (!ip) { ctlMessage.value = '请输入控制器 IP'; ctlOk.value = false; return }
  localStorage.setItem('wsDebug.controllerIp', ip)
  void callMotion('/connect', { ip })
}

function disconnectController(): void {
  void callMotion('/disconnect')
}
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
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.badge::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.badge.on::before { background: #16a34a; box-shadow: 0 0 6px #16a34a; }
.badge.off::before { background: #9ca3af; }
.badge.pending::before { background: #f59e0b; }
.count {
  margin-left: auto;
  font-size: 13px;
  color: #6b7280;
}
.err { color: #b91c1c; font-size: 12px; }
.btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.btn:hover { background: #f3f4f6; }
.btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn.primary:hover { background: #1d4ed8; }
.btn[disabled] { opacity: 0.5; cursor: not-allowed; }
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
.conn-bar label { display: flex; align-items: center; gap: 6px; color: #374151; }
.conn-bar input {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}
.conn-bar label input { width: 180px; }
.ctl-msg { font-size: 12px; margin-left: 4px; }
.ctl-msg.ok { color: #15803d; }
.ctl-msg.err { color: #b91c1c; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  margin-bottom: 12px;
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
.axes table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.axes th, .axes td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
}
.axes th { background: #f3f4f6; }
.raw pre {
  max-height: 240px;
  overflow: auto;
  background: #111827;
  color: #d1fae5;
  padding: 8px;
  border-radius: 4px;
}
.muted { color: #6b7280; font-size: 13px; }
.camera-section { margin-bottom: 12px; }
.camera-card { margin-bottom: 0; }
.camera-img { width: 100%; max-height: 360px; object-fit: contain; background: #000; border-radius: 4px; margin-top: 8px; }
.cam-rec { font-size: 16px; margin-left: 8px; color: #9ca3af; }
.cam-rec.on { color: #dc2626; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
