<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'
import { useRs232WorkbenchStore } from '../stores/rs232WorkbenchStore'
import { applyLaserParams, type LaserApplyPayload } from '../utils/laserApi'
import { closeRs232, openRs232, sendRs232 } from '../utils/rs232Api'
import type { LaserTransmissionMode } from '../types/settings'
import { useNotification } from '../composables/useNotification'

const { success, error, info } = useNotification()

const rs232Store = useRs232WorkbenchStore()
const { workbench: rs232Workbench } = storeToRefs(rs232Store)
const LASER_RS232_OPEN_DELAY_MS = 1000
const LASER_RS232_POST_DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type LaserRs232Cmd = 'POW' | 'REPF' | 'LD1CS' | 'QSW' | 'LD1' | 'SHU' | 'GAP'

/** RS232 一帧：ASCII 指令（CR/LF 固定使用 \\r\\n） */
function buildLaserRs232Payload(cmd: LaserRs232Cmd): string {
  if (cmd === 'POW') return `POW ${laserPower.value ?? 0}\r\n`
  if (cmd === 'REPF') return `REPF ${laserFrequency.value ?? 0}\r\n`
  if (cmd === 'LD1CS') return `LD1CS ${laserCurrent.value ?? 0}\r\n`
  if (cmd === 'QSW') return 'QSW 1\r\n'
  if (cmd === 'LD1') return 'LD1 1\r\n'
  if (cmd === 'SHU') return 'SHU 1\r\n'
  if (cmd === 'GAP') return 'GAP 1\r\n'
  return ''
}

const isLaserPanelExpanded = ref(false)

const laserManufacturer = ref('科猛激光')
const laserPower = ref<number | null>(930)
const laserFrequency = ref<number | null>(8000)
const laserCurrent = ref<number | null>(10)
const transmissionMode = ref<LaserTransmissionMode>('RS232')

const baselineLoaded = ref(false)
const appliedBaselineManufacturer = ref<string | null>(null)
const appliedBaselinePower = ref<number | null>(null)
const appliedBaselineFrequency = ref<number | null>(null)
const appliedBaselineCurrent = ref<number | null>(null)
const appliedBaselineTransmission = ref<LaserTransmissionMode | null>(null)
const applying = ref(false)

// const transmissionOptions: LaserTransmissionMode[] = ['网线', 'RS232']

const EPS = 1e-6
const numericEqual = (a: number | null, b: number | null): boolean => {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) < EPS
}

const hasPendingApplyChanges = computed(() => {
  if (!baselineLoaded.value) return false
  return (
    laserManufacturer.value !== (appliedBaselineManufacturer.value ?? '') ||
    !numericEqual(laserPower.value, appliedBaselinePower.value) ||
    !numericEqual(laserFrequency.value, appliedBaselineFrequency.value) ||
    !numericEqual(laserCurrent.value, appliedBaselineCurrent.value) ||
    transmissionMode.value !== appliedBaselineTransmission.value
  )
})

function syncBaselineFromForm(): void {
  appliedBaselineManufacturer.value = laserManufacturer.value
  appliedBaselinePower.value = laserPower.value
  appliedBaselineFrequency.value = laserFrequency.value
  appliedBaselineCurrent.value = laserCurrent.value
  appliedBaselineTransmission.value = transmissionMode.value
  baselineLoaded.value = true
}

onMounted(() => {
  syncBaselineFromForm()
})

async function handleApplySettings(isOpen:boolean=false): Promise<void> {
  if (applying.value) return
  applying.value = true
  try {
    const payload: LaserApplyPayload = {
      laserManufacturer: laserManufacturer.value || undefined,
      laserPower: laserPower.value ?? undefined,
      laserFrequency: laserFrequency.value ?? undefined,
      laserCurrent: laserCurrent.value ?? undefined,
      transmissionMode: transmissionMode.value
    }

    if (transmissionMode.value === 'RS232') {
      const openRes = await openRs232({
        port: { ...rs232Workbench.value.port },
        receive: { ...rs232Workbench.value.receive },
        send: { ...rs232Workbench.value.send }
      })
      if (isOpen) {
        info('正在打开激光器，请稍后...', openRes.message || '已打开 RS232',10000)
      } else {
        info('正在下发参数，请稍后...', openRes.message || '已打开 RS232')
      }

      if (!openRes.success) {
        error('应用失败', openRes.message || '无法打开 RS232，请检查「详细 RS232」中的串口配置')
        return
      }

      try {
        const steps: LaserRs232Cmd[] = isOpen
          ? ['QSW', 'LD1', 'SHU', 'GAP','POW', 'REPF', 'LD1CS']
          : ['POW', 'REPF', 'LD1CS']

        // 优化：参数三条依次发送，最后统一等待 2 秒再断开。
        for (const step of steps) {
          const sendRes = await sendRs232({
            port: { ...rs232Workbench.value.port },
            send: {
              ...rs232Workbench.value.send,
              mode: 'ascii',
              payload: buildLaserRs232Payload(step),
            },
          })
          if (!sendRes.success) {
            error('应用失败', sendRes.message || 'RS232 发送失败')
            return
          }

          // 打开激光器时，QSW/LD1/SHU 之间给一点缓冲；关闭由 GAP 接管或由设备自行处理。
          await sleep(LASER_RS232_OPEN_DELAY_MS)
        }

        await sleep(LASER_RS232_POST_DELAY_MS)
      } finally {
        await closeRs232()
      }
    }

    if (isOpen) {
      success('应用成功', '已通过 RS232 打开激光器')
      return
    }

    const res = await applyLaserParams(payload)
    if (!res.success) {
      error('应用失败', res.message || '激光参数同步后端失败')
      return
    }

    appliedBaselineManufacturer.value = laserManufacturer.value
    appliedBaselinePower.value = laserPower.value
    appliedBaselineFrequency.value = laserFrequency.value
    appliedBaselineCurrent.value = laserCurrent.value
    appliedBaselineTransmission.value = transmissionMode.value
    success(
      '应用成功',
      transmissionMode.value === 'RS232'
        ? isOpen
          ? '已通过 RS232 打开激光器'
          : '已通过 RS232 下发功率/频率/电流'
        : res.message || '激光参数已同步到后端'
    )
  } finally {
    applying.value = false
  }
}

const handleApply = () => handleApplySettings(false)
const handleOpenLaser = () => handleApplySettings(true)
const emit = defineEmits<{(e: 'open-right-panel', target: string): void}>()
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isLaserPanelExpanded ? 'min-h-[min(100px,46vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isLaserPanelExpanded"
      action-target="DetailedRs232Send"
      @open-right-panel="(target) => emit('open-right-panel', target)"
      title="激光面板"
    />
    <!-- <div v-show="isLaserPanelExpanded" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >

      </div>
    </div> -->
    <div class="grid grid-cols-3 gap-3" v-show="isLaserPanelExpanded">
      <!-- <label class="col-span-2 flex min-w-0 flex-col gap-1">
        <span class="text-xs text-(--app-text-muted)">激光厂家</span>
        <input
          v-model="laserManufacturer"
          type="text"
          class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
        />
      </label>
      <label class="col-span-1 flex min-w-0 flex-col gap-1">
        <span class="text-xs text-(--app-text-muted)">传输方式</span>
        <select
          v-model="transmissionMode"
          class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
        >
          <option v-for="opt in transmissionOptions" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
      </label> -->
      <label class="flex min-w-0 gap-1">
        <span class="text-xs text-(--app-text-muted)">功率</span>
        <input
          v-model.number="laserPower"
          type="number"
          min="0"
          step="1"
          class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
        />
      </label>
      <label class="flex min-w-0 gap-1">
        <span class="text-xs text-(--app-text-muted)">频率</span>
        <input
          v-model.number="laserFrequency"
          type="number"
          min="0"
          step="1"
          class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
        />
      </label>
      <label class="col-span-1 flex min-w-0 gap-1">
        <span class="text-xs text-(--app-text-muted)">电流</span>
        <input
          v-model.number="laserCurrent"
          type="number"
          min="0"
          step="0.1"
          class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
        />
      </label>
    </div>
    <div class="mt-4 flex w-full gap-3">
      <button
        v-if="transmissionMode === 'RS232'"
        type="button"
        class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-2.5 text-sm font-medium text-sky-100/95 transition hover:bg-sky-950/55 disabled:opacity-50"
        :disabled="applying"
        @click="handleOpenLaser"
      >
        {{ applying ? '打开中...' : '打开激光器' }}
      </button>
      <button
        v-if="hasPendingApplyChanges"
        type="button"
        class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-sm font-medium text-emerald-100/95 transition hover:bg-emerald-950/55 disabled:opacity-50"
        :disabled="applying"
        @click="handleApply"
      >
        {{ applying ? '应用中...' : '应用' }}
      </button>
    </div>
  </div>
</template>
