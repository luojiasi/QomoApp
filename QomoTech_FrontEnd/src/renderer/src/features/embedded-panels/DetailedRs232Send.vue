<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  createRs232Sections,
  RS232_COM_PORT_OPTIONS,
  RS232_SEND_MODE_OPTIONS,
} from '../../configs/settings'
import { useNotification } from '@/shared/composables/useNotification'
import { useReservePages } from '../../composables/useSettingsPages'
import { useReservePagesStore } from '../../stores/settings'
import { RS232_WORKBENCH_STORAGE_KEY } from '../../configs/storageKeys'
import { useRs232WorkbenchStore } from '../../stores/rs232WorkbenchStore'
import type { Rs232QuickCommand, Rs232SendMode, Rs232SendRequest, Rs232SerialSessionRequest } from '../../types/settings'
import { formatSettingValue } from '../../utils/settings'
import { useRs232Polling } from '../../composables/useRs232Polling'
import {
  closeRs232,
  fetchRs232Buffer,
  fetchRs232Ports,
  openRs232,
  sendRs232,
  type Rs232PortInfo
} from '../../api/device/rs232'
const props = defineProps<{
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const reserveStore = useReservePagesStore()
const rs232Store = useRs232WorkbenchStore()
const { workbench } = storeToRefs(rs232Store)
const { success, error } = useNotification()

const { getReservePageByPath } = useReservePages()

const page = computed(() => getReservePageByPath('/detailed-rs232-send'))
const sections = computed(() => createRs232Sections(workbench.value))
const saving = ref(false)

const portSection = computed(() => sections.value.find((s) => s.id === 'rs232-port') ?? null)
const sendSection = computed(() => sections.value.find((s) => s.id === 'rs232-send') ?? null)
const receiveSection = computed(() => sections.value.find((s) => s.id === 'rs232-receive') ?? null)

const receiveLogRef = ref<HTMLTextAreaElement | null>(null)

/** 与后端单例串口会话同步：打开后可轮询缓冲、发送 */
const serialConnected = ref(false)
const portsFromApi = ref<Rs232PortInfo[]>([])
const loadingPorts = ref(false)
const busyOpenClose = ref(false)
const busySend = ref(false)

const portNameOptions = computed(() => {
  const set = new Set<string>([...RS232_COM_PORT_OPTIONS])
  for (const p of portsFromApi.value) {
    if (p.device) set.add(p.device)
  }
  return Array.from(set)
})

async function pollReceiveBuffer(): Promise<void> {
  const res = await fetchRs232Buffer(false)
  if (res.success && res.data && typeof res.data.text === 'string') {
    workbench.value.receiveBuffer = res.data.text
  }
}

useRs232Polling({
  serialConnected,
  autoSendEnabled: computed(() => workbench.value.send.autoSend),
  autoSendIntervalMs: computed(() => workbench.value.send.autoSendIntervalMs),
  onPollBuffer: pollReceiveBuffer,
  onAutoSend: async () => {
    if (!serialConnected.value) return
    await sendRs232(buildSendPayload())
  },
})

function buildOpenPayload(): Rs232SerialSessionRequest {
  return {
    port: { ...workbench.value.port },
    receive: { ...workbench.value.receive },
    send: { ...workbench.value.send }
  }
}

function buildSendPayload(): Rs232SendRequest {
  return {
    port: { ...workbench.value.port },
    send: { ...workbench.value.send }
  }
}

async function loadDetectedPorts(): Promise<void> {
  loadingPorts.value = true
  try {
    const res = await fetchRs232Ports()
    if (res.success && res.data?.ports) {
      portsFromApi.value = res.data.ports
      return
    }
    if (!res.success) {
      error('获取串口列表失败', res.message ?? '')
    }
  } finally {
    loadingPorts.value = false
  }
}

async function handleOpenSerial(): Promise<void> {
  busyOpenClose.value = true
  try {
    const res = await openRs232(buildOpenPayload())
    if (!res.success) {
      error('连接失败', res.message ?? '')
      return
    }
    serialConnected.value = true
    success('已连接', res.message ?? '已连接后端并启动接收')
    await pollReceiveBuffer()
  } finally {
    busyOpenClose.value = false
  }
}

async function handleCloseSerial(): Promise<void> {
  busyOpenClose.value = true
  try {
    serialConnected.value = false
    const res = await closeRs232()
    serialConnected.value = false
    if (!res.success) {
      error('断开失败', res.message ?? '')
      return
    }
    success('已断开', res.message ?? '')
  } finally {
    busyOpenClose.value = false
  }
}

async function doSend(options?: { silentSuccess?: boolean }): Promise<void> {
  if (!serialConnected.value) {
    if (!options?.silentSuccess) {
      error('请先连接串口', '需先点击「连接」建立会话')
    }
    return
  }
  busySend.value = true
  try {
    const res = await sendRs232(buildSendPayload())
    if (!res.success) {
      error('发送失败', res.message ?? '')
      return
    }
    if (!options?.silentSuccess) {
      success('已发送', res.message ?? '')
    }
  } finally {
    busySend.value = false
  }
}

function modeLabel(mode: Rs232SendMode): string {
  return mode === 'hex' ? 'HEX' : 'ASCII'
}

function applyQuickCommand(command: Rs232QuickCommand): void {
  workbench.value.send.mode = command.mode
  workbench.value.send.payload = command.payload
}

const editingQuickCommandDraft = ref<Rs232QuickCommand | null>(null)

function startEditQuickCommand(command: Rs232QuickCommand): void {
  // 创建一份本地副本，避免用户还没保存时就直接污染工作台数据
  editingQuickCommandDraft.value = { ...command }
}

function cancelEditQuickCommand(): void {
  editingQuickCommandDraft.value = null
}

function saveEditQuickCommand(): void {
  if (!editingQuickCommandDraft.value) return

  const draft = editingQuickCommandDraft.value
  const title = draft.title.trim()
  if (!title) {
    error('标题不能为空', '请为快捷命令填写一个标题。')
    return
  }

  const description = draft.description.trim()
  const list = workbench.value.quickCommands
  const exists = list.some((c) => c.id === draft.id)
  if (!exists) {
    error('保存失败', '该快捷命令不存在或已被更改。')
    return
  }

  // 通过替换数组元素来确保 Vue 对数组变更能可靠追踪
  workbench.value.quickCommands = list.map((c) => (
    c.id === draft.id
      ? { ...draft, title, description }
      : c
  ))

  success('已保存快捷命令', `「${title}」已更新。`)
  cancelEditQuickCommand()
}

function clearPayload(): void {
  workbench.value.send.payload = ''
}

async function clearReceiveBuffer(): Promise<void> {
  workbench.value.receiveBuffer = ''
  if (serialConnected.value) {
    await fetchRs232Buffer(true)
  }
}

async function handleSaveToLocalStorage(): Promise<void> {
  saving.value = true
  try {
    await rs232Store.saveToLocalStorageNow()
    success(
      '已保存到本地存储',
      `键名 ${RS232_WORKBENCH_STORAGE_KEY}；编辑时也会自动防抖写入。`
    )
  } finally {
    saving.value = false
  }
}

async function handleSaveToLocalFile(): Promise<void> {
  saving.value = true
  try {
    await rs232Store.saveToLocalStorageNow()
    const json = JSON.stringify(rs232Store.workbench, null, 2)
    const save = window.api?.saveJsonToFile
    if (!save) {
      success(
        '已同步到本地存储',
        '当前为浏览器预览，未调用文件保存对话框。请使用 Electron 运行以导出 JSON。'
      )
      return
    }
    const res = await save('rs232-workbench', json)
    if (res.ok) {
      success('已保存', res.filePath)
      return
    }
    if ('canceled' in res && res.canceled) {
      return
    }
    error('保存失败', 'error' in res ? res.error : '')
  } finally {
    saving.value = false
  }
}

watch(
  () => workbench.value.receiveBuffer,
  async () => {
    if (!workbench.value.receive.autoScroll) return
    await nextTick()
    const el = receiveLogRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }
)

onMounted(async () => {
  await reserveStore.loadReservePages()
  await rs232Store.loadRs232Workbench()
  await loadDetectedPorts()
})
onMounted(async () => {
  await handleCloseSerial()
})

</script>

<template>
  <div v-if="!props.embedded" class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">激光控制区</h1>
            <p class="app-text-secondary mt-3 max-w-3xl text-sm leading-6">
              {{ page.description }}
            </p>
          </div>
          <RouterLink
            to="/home"
            class="app-card-soft app-text-primary rounded-xl border border-(--app-border) px-5 py-3 text-center font-medium transition hover:bg-(--app-card)"
          >
            返回首页
          </RouterLink>
        </div>
      </div>

      <!-- <div class="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]"> -->
      <div class="grid gap-6 xl:grid-cols-[1fr]">
        <section class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3 gap-y-2">
            <h2 class="app-text-primary text-xl font-semibold">串口参数配置</h2>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-emerald-500/50 bg-emerald-700/85 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="serialConnected || busyOpenClose"
                @click="handleOpenSerial"
              >
                {{ busyOpenClose && !serialConnected ? '连接中…' : '连接' }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-rose-500/50 bg-rose-700/85 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!serialConnected || busyOpenClose"
                @click="handleCloseSerial"
              >
                {{ busyOpenClose && serialConnected ? '断开中…' : '断开' }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToLocalFile"
              >
                保存本地文件
              </button>
              <button
                type="button"
                class="app-card-soft app-text-primary rounded-lg border border-(--app-border) px-3 py-2 text-sm font-medium transition hover:bg-(--app-card) disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToLocalStorage"
              >
                本地存储
              </button>
            </div>
          </div>
          <p class="app-text-secondary mt-2 text-sm">
            点击「连接」将打开串口；「断开」将关闭会话
            <span
              v-if="serialConnected"
              class="ml-2 rounded bg-emerald-600/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
            >
              已连接
            </span>
          </p>
          <p v-if="portsFromApi.length" class="app-text-muted mt-2 text-xs">
            本机检测：
            <span v-for="(p, i) in portsFromApi" :key="p.device + i" class="mr-2 inline-block">
              {{ p.device }}<span v-if="p.description">（{{ p.description }}）</span>
            </span>
          </p>
          <p v-else-if="!loadingPorts" class="app-text-muted mt-2 text-xs">未从后端获取到串口列表（可仍选 COM1～COM10）。</p>

          <div class="mt-5 grid gap-4 sm:grid-cols-1">
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">串口号</span>
              <select
                v-model="workbench.port.portName"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="p in portNameOptions" :key="p" :value="p">
                  {{ p }}
                </option>
              </select>
            </label>

            <!-- <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">波特率</span>
              <select
                v-model.number="workbench.port.baudRate"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in RS232_BAUD_RATE_OPTIONS" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">数据位</span>
              <select
                v-model.number="workbench.port.dataBits"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in RS232_DATA_BITS_OPTIONS" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">校验位</span>
              <select
                v-model="workbench.port.parity"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in RS232_PARITY_OPTIONS" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">停止位</span>
              <select
                v-model.number="workbench.port.stopBits"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in RS232_STOP_BITS_OPTIONS" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">流控</span>
              <select
                v-model="workbench.port.flowControl"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in RS232_FLOW_CONTROL_OPTIONS" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">超时（ms）</span>
              <input
                v-model.number="workbench.port.timeoutMs"
                type="number"
                min="1"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">编码</span>
              <select
                v-model="workbench.port.encoding"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option value="utf-8">utf-8</option>
                <option value="gbk">gbk</option>
                <option value="ascii">ascii</option>
              </select>
            </label> -->
          </div>
        </section>


      </div>

      <div class="grid gap-6 xl:grid-cols-2">
      <section class="app-card rounded-2xl p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="app-text-primary text-xl font-semibold">发送内容</h2>
            <!-- <p class="app-text-secondary mt-2 text-sm">
              连接成功后，可单次发送或开启自动发送（轮询间隔由下方配置决定）。
            </p> -->
          </div>
          <!-- <div class="flex flex-wrap gap-2">
            <button
              v-for="mode in RS232_SEND_MODE_OPTIONS"
              :key="mode"
              type="button"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              :class="
                workbench.send.mode === mode
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'app-card-soft border-transparent hover:border-(--app-border)'
              "
              @click="workbench.send.mode = mode"
            >
              {{ modeLabel(mode) }}
            </button>
          </div> -->
        </div>

        <div class="mt-4">
          <!-- <p class="app-text-secondary text-xs">发送内容</p> -->
          <textarea
            v-model="workbench.send.payload"
            rows="6"
            class="app-text-primary mt-2 w-full rounded-xl border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
            :placeholder="
              workbench.send.mode === 'hex'
                ? 'HEX 示例：AA 55 00 01 FF'
                : 'ASCII 示例：AT+VER?'
            "
          />
        </div>
        <!-- <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <input v-model="workbench.send.appendCr" type="checkbox" />
            <span class="app-text-primary">附加 CR (\\r)</span>
          </label>
          <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <input v-model="workbench.send.appendLf" type="checkbox" />
            <span class="app-text-primary">附加 LF (\\n)</span>
          </label>
          <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <input v-model="workbench.send.autoSend" type="checkbox" />
            <span class="app-text-primary">自动发送</span>
          </label>
          <label class="space-y-1.5">
            <span class="app-text-secondary text-xs">自动发送间隔（ms）</span>
            <input
              v-model.number="workbench.send.autoSendIntervalMs"
              type="number"
              min="50"
              class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
            />
          </label>
        </div> -->
        <div class="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            :disabled="!serialConnected || busySend"
            @click="doSend()"
          >
            {{ busySend ? '发送中…' : '发送' }}
          </button>
          <button
            type="button"
            class="app-card-soft rounded-lg border border-(--app-border) px-4 py-2 text-sm font-medium"
            @click="clearPayload"
          >
            清空内容
          </button>
        </div>
      </section>

      <section class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">快捷命令模板</h2>
        <p class="app-text-secondary mt-2 text-sm">
          选择命令后将填充至发送区，可继续手动修改。
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <div
            v-for="command in workbench.quickCommands"
            :key="command.id"
            class="app-card-soft rounded-xl p-4 text-left transition hover:border hover:border-blue-500/40 cursor-pointer"
            role="button"
            tabindex="0"
            @click="applyQuickCommand(command)"
            @keydown.enter="applyQuickCommand(command)"
            @keydown.space.prevent="applyQuickCommand(command)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="app-text-primary text-sm font-semibold">
                  {{ command.title }}
                </p>
                <p class="app-text-secondary mt-1 text-xs line-clamp-2">
                  {{ command.description }}
                </p>
                <p class="app-text-muted mt-2 text-xs break-all">
                  {{ modeLabel(command.mode) }} · {{ command.payload }}
                </p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-(--app-border) bg-(--app-card) px-2 py-1 text-xs font-medium transition hover:bg-(--app-card-soft)"
                @click.stop="startEditQuickCommand(command)"
              >
                编辑
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="editingQuickCommandDraft"
          class="mt-4 app-card-soft rounded-2xl p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="app-text-primary text-base font-semibold">
              编辑快捷命令
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="app-card-soft rounded-lg border border-(--app-border) px-3 py-2 text-sm font-medium"
                @click="cancelEditQuickCommand"
              >
                取消
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                @click="saveEditQuickCommand"
              >
                保存
              </button>
            </div>
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class="space-y-1.5 sm:col-span-2">
              <span class="app-text-secondary text-xs">标题</span>
              <input
                v-model="editingQuickCommandDraft.title"
                type="text"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>

            <label class="space-y-1.5 sm:col-span-2">
              <span class="app-text-secondary text-xs">描述</span>
              <input
                v-model="editingQuickCommandDraft.description"
                type="text"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">模式</span>
              <select
                v-model="editingQuickCommandDraft.mode"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option
                  v-for="m in RS232_SEND_MODE_OPTIONS"
                  :key="m"
                  :value="m"
                >
                  {{ modeLabel(m) }}
                </option>
              </select>
            </label>

            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">载荷</span>
              <textarea
                v-model="editingQuickCommandDraft.payload"
                rows="3"
                class="app-text-primary w-full resize-y rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
          </div>
        </div>
      </section>
      </div>


      <section class="app-card rounded-2xl p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="app-text-primary text-xl font-semibold">数据接收</h2>
            <p class="app-text-secondary mt-2 text-sm">
              连接后由后端读线程写入缓冲；下方区域约每 250ms 刷新一次。连接与断开在上方「串口参数配置」中操作。
            </p>
          </div>
          
          <!-- <div class="flex flex-wrap gap-2">
            <button
              v-for="mode in RS232_SEND_MODE_OPTIONS"
              :key="`rx-${mode}`"
              type="button"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              :class="
                workbench.receive.mode === mode
                  ? 'border-emerald-500 bg-emerald-700/90 text-white shadow-sm'
                  : 'app-card-soft border-transparent hover:border-(--app-border)'
              "
              @click="workbench.receive.mode = mode"
            >
              接收 · {{ modeLabel(mode) }}
            </button>
          </div> -->
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="space-y-1.5">
            <span class="app-text-secondary text-xs">最大缓冲行数</span>
            <input
              v-model.number="workbench.receive.maxBufferLines"
              type="number"
              min="10"
              max="100000"
              class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
            />
          </label>
          <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm sm:col-span-1">
            <input v-model="workbench.receive.showTimestamp" type="checkbox" />
            <span class="app-text-primary">接收行显示时间戳</span>
          </label>
          <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm sm:col-span-1">
            <input v-model="workbench.receive.autoScroll" type="checkbox" />
            <span class="app-text-primary">新数据自动滚到底部</span>
          </label>
        </div>

        <div class="mt-4">
          <p class="app-text-secondary text-xs">接收缓冲区（只读）</p>
          <textarea
            ref="receiveLogRef"
            v-model="workbench.receiveBuffer"
            readonly
            rows="8"
            class="app-text-primary mt-2 w-full resize-y rounded-xl border border-(--app-border) bg-(--app-input-bg) px-3 py-2 font-mono text-sm outline-none ring-emerald-500/20 focus:border-emerald-500/40 focus:ring-2"
            placeholder="连接成功后，下行数据将显示在此处…"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="app-card-soft rounded-lg border border-(--app-border) px-4 py-2 text-sm font-medium"
            @click="clearReceiveBuffer"
          >
            清空接收区
          </button>
        </div>
      </section>



      <section class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">当前配置概览</h2>
        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div v-if="portSection" class="app-card-soft rounded-xl p-4">
            <p class="app-text-primary text-sm font-semibold">{{ portSection.title }}</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="field in portSection.fields" :key="field.key">
                <p class="app-text-secondary text-xs">{{ field.label }}</p>
                <p class="app-text-primary text-sm">
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </div>
          <div v-if="sendSection" class="app-card-soft rounded-xl p-4">
            <p class="app-text-primary text-sm font-semibold">{{ sendSection.title }}</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="field in sendSection.fields" :key="field.key">
                <p class="app-text-secondary text-xs">{{ field.label }}</p>
                <p class="app-text-primary text-sm break-all">
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </div>
          <div v-if="receiveSection" class="app-card-soft rounded-xl p-4">
            <p class="app-text-primary text-sm font-semibold">{{ receiveSection.title }}</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="field in receiveSection.fields" :key="field.key">
                <p class="app-text-secondary text-xs">{{ field.label }}</p>
                <p class="app-text-primary text-sm break-all">
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>





















  <div v-else class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- <div class="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]"> -->
      <div class="grid gap-6 xl:grid-cols-[1fr]">
        <section class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3 gap-y-2">
            <h2 class="app-text-primary text-xl font-semibold">串口参数配置</h2>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-(--app-border) app-card-soft px-3 py-2 text-sm font-medium transition hover:bg-(--app-card)"
                @click="emit('back')"
              >
                关闭面板
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToLocalFile"
              >
                保存本地文件
              </button>
              <button
                type="button"
                class="app-card-soft app-text-primary rounded-lg border border-(--app-border) px-3 py-2 text-sm font-medium transition hover:bg-(--app-card) disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToLocalStorage"
              >
                本地存储
              </button>
            </div>
          </div>
          <p v-if="portsFromApi.length" class="app-text-muted mt-2 text-xs">
            本机检测：
            <span v-for="(p, i) in portsFromApi" :key="p.device + i" class="mr-2 inline-block">
              {{ p.device }}<span v-if="p.description">（{{ p.description }}）</span>
            </span>
          </p>
          <p v-else-if="!loadingPorts" class="app-text-muted mt-2 text-xs">未从后端获取到串口列表（可仍选 COM1～COM10）。</p>

          <div class="mt-5 grid gap-4 sm:grid-cols-1">
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">串口号</span>
              <select
                v-model="workbench.port.portName"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="p in portNameOptions" :key="p" :value="p">
                  {{ p }}
                </option>
              </select>
            </label>
          </div>
        </section>


      </div>

      <div class="grid gap-6 xl:grid-cols-1">
      <section class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">快捷命令模板</h2>
        <p class="app-text-secondary mt-2 text-sm">
          选择命令后将填充至发送区，可继续手动修改。
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <div
            v-for="command in workbench.quickCommands"
            :key="command.id"
            class="app-card-soft rounded-xl p-4 text-left transition hover:border hover:border-blue-500/40 cursor-pointer"
            role="button"
            tabindex="0"
            @click="applyQuickCommand(command)"
            @keydown.enter="applyQuickCommand(command)"
            @keydown.space.prevent="applyQuickCommand(command)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="app-text-primary text-sm font-semibold">
                  {{ command.title }}
                </p>
                <p class="app-text-secondary mt-1 text-xs line-clamp-2">
                  {{ command.description }}
                </p>
                <p class="app-text-muted mt-2 text-xs break-all">
                  {{ modeLabel(command.mode) }} · {{ command.payload }}
                </p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-(--app-border) bg-(--app-card) px-2 py-1 text-xs font-medium transition hover:bg-(--app-card-soft)"
                @click.stop="startEditQuickCommand(command)"
              >
                编辑
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="editingQuickCommandDraft"
          class="mt-4 app-card-soft rounded-2xl p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="app-text-primary text-base font-semibold">
              编辑快捷命令
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="app-card-soft rounded-lg border border-(--app-border) px-3 py-2 text-sm font-medium"
                @click="cancelEditQuickCommand"
              >
                取消
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                @click="saveEditQuickCommand"
              >
                保存
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-rows-2">
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">描述</span>
              <input
                v-model="editingQuickCommandDraft.description"
                type="text"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <textarea
                v-model="editingQuickCommandDraft.payload"
                rows="3"
                class="app-text-primary w-full resize-y rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
          </div>
        </div>
      </section>
      </div>



      <section class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">当前配置概览</h2>
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div v-if="portSection" class="app-card-soft rounded-xl p-4">
            <p class="app-text-primary text-sm font-semibold">{{ portSection.title }}</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="field in portSection.fields" :key="field.key">
                <p class="app-text-secondary text-xs">{{ field.label }}</p>
                <p class="app-text-primary text-sm">
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </div>
          <div v-if="sendSection" class="app-card-soft rounded-xl p-4">
            <p class="app-text-primary text-sm font-semibold">{{ sendSection.title }}</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="field in sendSection.fields" :key="field.key">
                <p class="app-text-secondary text-xs">{{ field.label }}</p>
                <p class="app-text-primary text-sm break-all">
                  {{ formatSettingValue(field.value, field.unit) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  
</template>
