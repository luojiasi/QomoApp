<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import ControlPanelBase from '@/modules/motion/panels/ControlPanelBase.vue'
import { useRs232WorkbenchStore } from './rs232WorkbenchStore'
import { useLaserSettingsStore } from './useLaserStore'
import { applyLaserParams, controlMMLaser, type LaserApplyPayload } from './laserApi'
import { closeRs232, openRs232, sendRs232 } from './rs232Api'
import { useNotification } from '@/shared/composables/useNotification'

const { success, error, info } = useNotification()

const rs232Store = useRs232WorkbenchStore()
const { workbench: rs232Workbench } = storeToRefs(rs232Store)

const laserStore = useLaserSettingsStore()
const { settings } = storeToRefs(laserStore)

const LASER_RS232_OPEN_DELAY_MS = 1000
const LASER_RS232_POST_DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** KMJGQ_XYT RS232 指令 */
function buildXingYanTongPayload(cmd: string): string {
  const s = settings.value
  if (cmd === 'POW') return `POW ${s.power || '0'}\r\n`
  if (cmd === 'REPF') return `REPF ${s.frequency || '0'}\r\n`
  if (cmd === 'LD1CS') return `LD1CS ${s.current || '0'}\r\n`
  if (cmd === 'QSW') return 'QSW 1\r\n'
  if (cmd === 'LD1') return 'LD1 1\r\n'
  if (cmd === 'SHU') return 'SHU 1\r\n'
  if (cmd === 'GAP') return 'GAP 1\r\n'
  return ''
}

/** KMJGQ_MM RS232 指令 */
function buildMeiManPayload(cmd: string): string {
  const s = settings.value
  if (cmd === 'mode') return `set_mode:4\r\n`
  if (cmd === 'power') return `set_power:${s.power || '0'}\r\n`
  if (cmd === 'freq') return `set_freq:${s.frequency || '0'}\r\n`
  if (cmd === 'duty') return `set_duty:${s.current || '0'}\r\n`
  if (cmd === 'laser_on') return 'laser_on\r\n'
  return ''
}

const isMeiMan = computed(() => settings.value.manufacturer === 'KMJGQ_MM')

// ------------------------------------------------------------------
// 厂家自适应标签
// ------------------------------------------------------------------

const powerLabel = computed(() => isMeiMan.value ? '功率 %' : '功率')
const powerPlaceholder = computed(() => isMeiMan.value ? '例:50' : '例:930')
const frequencyLabel = computed(() => isMeiMan.value ? '频率 kHz' : '频率 Hz')
const frequencyPlaceholder = computed(() => isMeiMan.value ? '例:80' : '例:6000')
const currentLabel = computed(() => isMeiMan.value ? '占空比 %' : '电流 A')
const currentPlaceholder = computed(() => isMeiMan.value ? '例:35' : '例:80')

// ------------------------------------------------------------------
// 厂家切换
// ------------------------------------------------------------------

const manufacturerOptions = ['KMJGQ_XYT', 'KMJGQ_MM']

function onManufacturerChange(mfr: string): void {
  laserStore.switchManufacturer(mfr)
}

// ------------------------------------------------------------------
// 本地状态
// ------------------------------------------------------------------

const isLaserPanelExpanded = ref(false)

const baselineLoaded = ref(false)
const appliedBaselineManufacturer = ref<string | null>(null)
const appliedBaselinePower = ref<string | null>(null)
const appliedBaselineFrequency = ref<string | null>(null)
const appliedBaselineCurrent = ref<string | null>(null)
const applying = ref(false)
const saving = ref(false)
const mmOperating = ref(false)

const hasPendingApplyChanges = computed(() => {
  if (!baselineLoaded.value) return false
  return (
    settings.value.manufacturer !== (appliedBaselineManufacturer.value ?? '') ||
    settings.value.power !== (appliedBaselinePower.value ?? '') ||
    settings.value.frequency !== (appliedBaselineFrequency.value ?? '') ||
    settings.value.current !== (appliedBaselineCurrent.value ?? '')
  )
})

function syncBaselineFromForm(): void {
  appliedBaselineManufacturer.value = settings.value.manufacturer
  appliedBaselinePower.value = settings.value.power
  appliedBaselineFrequency.value = settings.value.frequency
  appliedBaselineCurrent.value = settings.value.current
  baselineLoaded.value = true
}

onMounted(async () => {
  await laserStore.load()
  syncBaselineFromForm()
})

// ------------------------------------------------------------------
// 操作
// ------------------------------------------------------------------

async function handleSave(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const ok = await laserStore.save()
    if (ok) {
      success('保存成功', '激光设置已保存到配置文件')
    } else {
      error('保存失败', '无法写入激光设置文件')
    }
  } finally {
    saving.value = false
  }
}

async function handleMMLaserControl(on: boolean): Promise<void> {
  if (mmOperating.value) return
  mmOperating.value = true
  try {
    const res = await controlMMLaser(on)
    if (res?.success) {
      success(on ? '激光器已打开' : '激光器已关闭')
    } else {
      error('操作失败', res?.message || 'RS232 发送失败')
    }
  } finally {
    mmOperating.value = false
  }
}

async function handleApplySettings(isOpen: boolean = false): Promise<void> {
  if (applying.value) return
  applying.value = true
  try {
    const s = settings.value
    const payload: LaserApplyPayload = {
      laserManufacturer: s.manufacturer || undefined,
      laserPower: Number(s.power) || undefined,
      laserFrequency: Number(s.frequency) || undefined,
      laserCurrent: Number(s.current) || undefined
    }

    const openRes = await openRs232({
      port: { ...rs232Workbench.value.port },
      receive: { ...rs232Workbench.value.receive },
      send: { ...rs232Workbench.value.send }
    })

    if (isOpen) {
      info('正在打开激光器，请稍后...', openRes.message || '已打开 RS232', 10000)
    } else {
      info('正在下发参数，请稍后...', openRes.message || '已打开 RS232')
    }

    if (!openRes.success) {
      error('应用失败', openRes.message || '无法打开 RS232，请检查「详细 RS232」中的串口配置')
      return
    }

    try {
      if (isMeiMan.value) {
        const steps = isOpen
          ? ['mode', 'power', 'freq', 'duty', 'laser_on']
          : ['power', 'freq', 'duty']
        for (const step of steps) {
          const sendRes = await sendRs232({
            port: { ...rs232Workbench.value.port },
            send: {
              ...rs232Workbench.value.send,
              mode: 'ascii',
              payload: buildMeiManPayload(step)
            }
          })
          if (!sendRes.success) {
            error('应用失败', sendRes.message || 'RS232 发送失败')
            return
          }
          await sleep(LASER_RS232_OPEN_DELAY_MS)
        }
      } else {
        const steps: string[] = isOpen
          ? ['QSW', 'LD1', 'SHU', 'GAP', 'POW', 'REPF', 'LD1CS']
          : ['POW', 'REPF', 'LD1CS']
        for (const step of steps) {
          const sendRes = await sendRs232({
            port: { ...rs232Workbench.value.port },
            send: {
              ...rs232Workbench.value.send,
              mode: 'ascii',
              payload: buildXingYanTongPayload(step)
            }
          })
          if (!sendRes.success) {
            error('应用失败', sendRes.message || 'RS232 发送失败')
            return
          }
          await sleep(LASER_RS232_OPEN_DELAY_MS)
        }
      }

      await sleep(LASER_RS232_POST_DELAY_MS)
    } finally {
      await closeRs232()
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

    syncBaselineFromForm()
    success('应用成功', '已通过 RS232 下发功率/频率/电流')
  } finally {
    applying.value = false
  }
}

const handleApply = () => handleApplySettings(false)
const handleOpenLaser = () => handleApplySettings(true)
const emit = defineEmits<{(e: 'open-right-panel', target: string): void}>()
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isLaserPanelExpanded"
    title="激光面板"
    action-target="DetailedRs232Send"
    :class="isLaserPanelExpanded ? 'min-h-[min(100px,46vh)]' : ''"
    @open-right-panel="(target: string) => emit('open-right-panel', target)"
  >
    <template #default>
      <div class="grid grid-cols-2 gap-3">
        <!-- 厂家 + 端口 -->
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-(--app-text-muted)">厂家</span>
          <select
            :value="settings.manufacturer"
            class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
            @change="onManufacturerChange(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in manufacturerOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-(--app-text-muted)">端口</span>
          <input
            v-model="settings.port"
            type="text"
            class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
          />
        </label>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-3">
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-(--app-text-muted)">{{ powerLabel }}</span>
          <input
            v-model="settings.power"
            type="text"
            :placeholder="powerPlaceholder"
            class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-(--app-text-muted)">{{ frequencyLabel }}</span>
          <input
            v-model="settings.frequency"
            type="text"
            :placeholder="frequencyPlaceholder"
            class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-(--app-text-muted)">{{ currentLabel }}</span>
          <input
            v-model="settings.current"
            type="text"
            :placeholder="currentPlaceholder"
            class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 dark:shadow-black/40"
          />
        </label>
      </div>
    </template>

    <template #footer>
      <div class="mt-4 flex w-full gap-3">
        <button
          type="button"
          class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-950/35 px-4 py-2.5 text-sm font-medium text-amber-100/95 transition hover:bg-amber-950/55 disabled:opacity-50"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <button
          type="button"
          class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-2.5 text-sm font-medium text-sky-100/95 transition hover:bg-sky-950/55 disabled:opacity-50"
          :disabled="applying"
          @click="handleOpenLaser"
        >
          {{ applying ? '打开中...' : '打开激光器' }}
        </button>
        <button
          v-if="isMeiMan"
          type="button"
          class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-sm font-medium text-emerald-100/95 transition hover:bg-emerald-950/55 disabled:opacity-50"
          :disabled="mmOperating"
          @click="handleMMLaserControl(true)"
        >
          {{ mmOperating ? '...' : '打开激光' }}
        </button>
        <button
          v-if="isMeiMan"
          type="button"
          class="inline-flex w-full flex-1 items-center justify-center rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-2.5 text-sm font-medium text-rose-100/95 transition hover:bg-rose-950/55 disabled:opacity-50"
          :disabled="mmOperating"
          @click="handleMMLaserControl(false)"
        >
          {{ mmOperating ? '...' : '关闭激光' }}
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
    </template>
  </ControlPanelBase>
</template>
