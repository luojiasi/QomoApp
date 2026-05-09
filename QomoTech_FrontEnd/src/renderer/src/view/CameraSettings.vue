<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import CameraPic from '../components/Camera/cameraPic.vue'
import { useNotification } from '../composables/useNotification'
import { CAMERA_SETTINGS_STORAGE_KEY, useCameraSettingsStore } from '../stores/cameraSettingsStore'
import {
  disconnectCamera,
  fetchCameraDevices,
  getCameraStatus,
  initSdkEnumAndConnectIndex0,
  setCameraExposure,
  setCameraFrameSpeed,
  setCameraMirror,
  setCameraWhiteBalance,
  type CameraDeviceInfo,
  type CameraStatusPayload
} from '../api/camera'

const { success, error } = useNotification()
const cameraStore = useCameraSettingsStore()
const { cameraSettings } = storeToRefs(cameraStore)

const cameraDevices = ref<CameraDeviceInfo[]>([])
const cameraStatus = ref<CameraStatusPayload | null>(null)
const busy = ref(false)

const isConnected = computed(() => Boolean(cameraStatus.value?.connected))
const speedLabel = computed(() => {
  const level = Number(cameraSettings.value.frameSpeedLevel)
  if (level === 0) return 'HIGHEST_SPEED'
  if (level === 1) return 'HIGH_SPEED'
  if (level === 2) return 'LOW_SPEED'
  return 'LOWEST_SPEED'
})

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function applyStatus(status: CameraStatusPayload): void {
  cameraStatus.value = status
  if (typeof status.selected_index === 'number') {
    cameraSettings.value.cameraIndex = status.selected_index
  }
}

async function loadDevices(): Promise<void> {
  const res = await fetchCameraDevices()
  if (res.success && Array.isArray(res.data?.devices)) {
    cameraDevices.value = res.data.devices
  } else if (!res.success) {
    error('获取相机列表失败', res.message ?? '')
  }
}

async function loadStatus(): Promise<void> {
  const res = await getCameraStatus()
  if (res.success && res.data) {
    applyStatus(res.data)
  }
}

async function handleConnect(): Promise<void> {
  busy.value = true
  try {
    const res = await initSdkEnumAndConnectIndex0()
    if (!res.success || !res.data) {
      error('连接失败', res.message ?? '')
      return
    }
    cameraSettings.value.cameraIndex = 0
    applyStatus(res.data)
    success('相机连接成功', '已按流程完成：初始化SDK -> 枚举设备 -> 选择index=0 -> 打开预览')
  } finally {
    busy.value = false
  }
}

async function handleDisconnect(): Promise<void> {
  busy.value = true
  try {
    const res = await disconnectCamera()
    if (!res.success || !res.data) {
      error('断开失败', res.message ?? '')
      return
    }
    applyStatus(res.data)
    success('相机已断开')
  } finally {
    busy.value = false
  }
}

async function handleApplyExposure(): Promise<void> {
  busy.value = true
  try {
    const res = await setCameraExposure({
      auto_exposure: Boolean(cameraSettings.value.autoExposure),
      exposure_time: clampInt(cameraSettings.value.exposureTime, 0, 65535, 1000)
    })
    if (!res.success || !res.data) {
      error('曝光参数下发失败', res.message ?? '')
      return
    }
    applyStatus(res.data)
    success('曝光参数已应用')
  } finally {
    busy.value = false
  }
}

async function handleApplyFrameSpeed(): Promise<void> {
  busy.value = true
  try {
    const res = await setCameraFrameSpeed({
      speed_level: cameraSettings.value.frameSpeedLevel,
      auto_tune: Boolean(cameraSettings.value.frameSpeedAutoTune),
      tune: clampFloat(cameraSettings.value.frameSpeedTune, 0, 1, 1)
    })
    if (!res.success || !res.data) {
      error('帧率参数下发失败', res.message ?? '')
      return
    }
    applyStatus(res.data)
    success('帧率参数已应用')
  } finally {
    busy.value = false
  }
}

async function handleApplyMirror(): Promise<void> {
  busy.value = true
  try {
    const res = await setCameraMirror({
      horizontal: Boolean(cameraSettings.value.mirrorHorizontal),
      vertical: Boolean(cameraSettings.value.mirrorVertical)
    })
    if (!res.success || !res.data) {
      error('镜像参数下发失败', res.message ?? '')
      return
    }
    applyStatus(res.data)
    success('镜像参数已应用')
  } finally {
    busy.value = false
  }
}

async function handleApplyWhiteBalance(once = false): Promise<void> {
  busy.value = true
  try {
    const res = await setCameraWhiteBalance({
      auto_white_balance: Boolean(cameraSettings.value.autoWhiteBalance),
      once,
      r_gain: clampInt(cameraSettings.value.whiteBalanceRGain, 0, 65535, 21),
      g_gain: clampInt(cameraSettings.value.whiteBalanceGGain, 0, 65535, 22),
      b_gain: clampInt(cameraSettings.value.whiteBalanceBGain, 0, 65535, 16)
    })
    if (!res.success || !res.data) {
      error('白平衡参数下发失败', res.message ?? '')
      return
    }
    applyStatus(res.data)
    success(once ? '一次白平衡执行成功' : '白平衡参数已应用')
  } finally {
    busy.value = false
  }
}

async function handleSaveLocalStorage(): Promise<void> {
  await cameraStore.saveToLocalStorageNow()
  success('已保存到本地存储', `键名 ${CAMERA_SETTINGS_STORAGE_KEY}`)
}

onMounted(async () => {
  await cameraStore.loadCameraSettings()
  await loadDevices()
  await loadStatus()
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <section class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">相机参数设置</h1>
          </div>
          <button
              type="button"
              class="app-card-soft app-text-primary rounded-lg border border-(--app-border) px-3 py-2 text-sm font-medium transition hover:bg-(--app-card)"
              :disabled="busy"
              @click="handleSaveLocalStorage"
            >
              保存本地参数
            </button>
          <RouterLink
            to="/home"
            class="app-card-soft app-text-primary rounded-xl border border-(--app-border) px-5 py-3 text-center font-medium transition hover:bg-(--app-card)"
          >
            返回首页
          </RouterLink>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="app-text-primary text-xl font-semibold">实时预览</h2>
            <span
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="isConnected ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'"
            >
              {{ isConnected ? '已连接' : '未连接' }}
            </span>
          </div>
            <p class="app-text-secondary mt-2 text-sm">
            图像通过 `WS /api/camera/ws` 持续推流刷新。
          </p>
          <div class="mt-4 overflow-hidden rounded-xl border border-(--app-border) bg-(--app-card-soft)">
            <div class="flex min-h-[360px] items-center justify-center">
              <CameraPic object-fit="contain" />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="app-card rounded-2xl p-5 shadow-sm">
            <p class="app-text-secondary text-sm">当前状态</p>
            <p class="app-text-primary mt-2 text-lg font-semibold">
              {{ cameraStatus?.last_error ? '有异常' : '正常' }}
            </p>
            <p v-if="cameraStatus?.last_error" class="mt-2 text-xs text-rose-700 break-all">
              {{ cameraStatus.last_error }}
            </p>
            <p class="app-text-secondary mt-3 text-xs">
              streaming: {{ cameraStatus?.streaming ? 'true' : 'false' }}
            </p>
            <p class="app-text-secondary text-xs">
              speed level: {{ speedLabel }}
            </p>
          </div>

          <div class="app-card rounded-2xl p-5 shadow-sm">
            <p class="app-text-secondary text-sm">连接控制</p>
            <label class="mt-3 block space-y-1.5">
              <span class="app-text-secondary text-xs">设备索引</span>
              <select
                v-model.number="cameraSettings.cameraIndex"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option v-for="item in cameraDevices" :key="item.list_index" :value="item.list_index">
                  {{ item.name }} | index={{ item.list_index }}
                </option>
                <option v-if="cameraDevices.length === 0" :value="cameraSettings.cameraIndex">
                  Camera {{ cameraSettings.cameraIndex }}
                </option>
              </select>
            </label>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-lg border border-emerald-500/50 bg-emerald-700/85 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                :disabled="busy || isConnected"
                @click="handleConnect"
              >
                连接
              </button>
              <button
                type="button"
                class="rounded-lg border border-rose-500/50 bg-rose-700/85 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                :disabled="busy || !isConnected"
                @click="handleDisconnect"
              >
                断开
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-3">
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-lg font-semibold">曝光参数</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">自动曝光</span>
              <select
                v-model="cameraSettings.autoExposure"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option :value="true">开启</option>
                <option :value="false">关闭</option>
              </select>
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">曝光时间</span>
              <input
                v-model.number="cameraSettings.exposureTime"
                type="number"
                min="0"
                max="65535"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <button
            type="button"
            class="mt-4 w-full rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            :disabled="busy || !isConnected"
            @click="handleApplyExposure"
          >
            应用曝光参数
          </button>
          </div>

        </div>

        <div class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-lg font-semibold">帧率参数</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-4">
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">档位(0-3)</span>
              <input
                v-model.number="cameraSettings.frameSpeedLevel"
                type="number"
                min="0"
                max="3"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">自动微调</span>
              <select
                v-model="cameraSettings.frameSpeedAutoTune"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option :value="true">开启</option>
                <option :value="false">关闭</option>
              </select>
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">微调(0-1)</span>
              <input
                v-model.number="cameraSettings.frameSpeedTune"
                type="number"
                min="0"
                max="1"
                step="0.01"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <button
            type="button"
            class="mt-4 w-full rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            :disabled="busy || !isConnected"
            @click="handleApplyFrameSpeed"
          >
            应用帧率参数
          </button>
          </div>
        </div>
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-lg font-semibold">镜像参数</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
              <input v-model="cameraSettings.mirrorHorizontal" type="checkbox" />
              <span class="app-text-primary">水平镜像</span>
            </label>
            <label class="app-card-soft flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
              <input v-model="cameraSettings.mirrorVertical" type="checkbox" />
              <span class="app-text-primary">垂直镜像</span>
            </label>
            <button
              type="button"
              class="mt-4 w-full rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
              :disabled="busy || !isConnected"
              @click="handleApplyMirror"
            >
              应用镜像参数
            </button>
          </div>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-1">
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-lg font-semibold">白平衡参数</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-6">
            <label class="space-y-1.5 sm:col-span-1">
              <span class="app-text-secondary text-xs">自动白平衡</span>
              <select
                v-model="cameraSettings.autoWhiteBalance"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              >
                <option :value="true">开启</option>
                <option :value="false">关闭</option>
              </select>
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">R Gain</span>
              <input
                v-model.number="cameraSettings.whiteBalanceRGain"
                type="number"
                min="0"
                max="65535"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">G Gain</span>
              <input
                v-model.number="cameraSettings.whiteBalanceGGain"
                type="number"
                min="0"
                max="65535"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <label class="space-y-1.5">
              <span class="app-text-secondary text-xs">B Gain</span>
              <input
                v-model.number="cameraSettings.whiteBalanceBGain"
                type="number"
                min="0"
                max="65535"
                class="app-text-primary w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </label>
            <button
              type="button"
              class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
              :disabled="busy || !isConnected"
              @click="handleApplyWhiteBalance(false)"
            >
              应用白平衡
            </button>
            <button
              type="button"
              class="rounded-lg border border-violet-500/50 bg-violet-600/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50"
              :disabled="busy || !isConnected"
              @click="handleApplyWhiteBalance(true)"
            >
              一次白平衡
            </button>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
