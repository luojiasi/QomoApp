<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref, toRef } from 'vue'
import AxisCenterCalibPanel from '@/modules/motion/components/AxisCenterCalibPanel.vue'
import CameraPic from '@/modules/camera/CameraPic.vue'
import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useNotification } from '@/shared/composables/useNotification'
import { getTenCameraFocusError, syncTenCameraFocusError } from '@/modules/program/api'
import { useTenPlusAxisCenterCalib } from '../composables/useTenPlusAxisCenterCalib'
import { TEN_PLUS_DEFAULT_CAMERA_FOCUS_ERROR } from '../constants/tenPlusCutting'
import TenPlusCuttingPage_CrosshairLines from './TenPlusCuttingPage_CrosshairLines.vue'
import TenPlusCuttingPage_CrosshairBar from './TenPlusCuttingPage_CrosshairBar.vue'

const props = defineProps<{
  slotIndex: number
}>()

const emit = defineEmits<{
  close: []
}>()

const { error, success } = useNotification()
const axisCalib = useTenPlusAxisCenterCalib(toRef(props, 'slotIndex'))
provide('axisCalib', axisCalib)
const { abortAxisCenterCalib } = axisCalib
useMotionKeyboard()

const cameraFocusError = ref(TEN_PLUS_DEFAULT_CAMERA_FOCUS_ERROR)
const isSavingFocusError = ref(false)

async function loadCameraFocusError(): Promise<void> {
  const res = await getTenCameraFocusError(props.slotIndex)
  if (!res.success || res.data == null) {
    error(res.message || `读取工位 ${props.slotIndex} 相机清晰误差失败`)
    cameraFocusError.value = TEN_PLUS_DEFAULT_CAMERA_FOCUS_ERROR
    return
  }
  const n = Number(res.data.value)
  cameraFocusError.value = Number.isFinite(n) ? n : TEN_PLUS_DEFAULT_CAMERA_FOCUS_ERROR
}

async function saveCameraFocusError(): Promise<void> {
  if (isSavingFocusError.value) return
  const n = Number(cameraFocusError.value)
  if (!Number.isFinite(n)) {
    error('相机清晰误差必须是有效数字')
    return
  }
  isSavingFocusError.value = true
  try {
    const res = await syncTenCameraFocusError(props.slotIndex, { value: n })
    if (!res.success || res.data == null) {
      throw new Error(res.message || `保存工位 ${props.slotIndex} 相机清晰误差失败`)
    }
    cameraFocusError.value = Number(res.data.value)
    success(`已保存工位 ${props.slotIndex} 相机清晰误差`, `${Number(res.data.value).toFixed(3)} mm`)
  } catch (err) {
    error('保存失败', err instanceof Error ? err.message : '保存相机清晰误差失败')
  } finally {
    isSavingFocusError.value = false
  }
}

function tryClose(): void {
  abortAxisCenterCalib()
  emit('close')
}

onMounted(() => {
  void loadCameraFocusError()
})

onUnmounted(() => {
  abortAxisCenterCalib()
})
</script>

<template>
  <div class="tpc-ur-overlay" @click.self="tryClose">
    <div class="tpc-ur-card" role="dialog" aria-modal="true">
      <div class="tpc-ur-head">
        <span>工位 #{{ slotIndex }} UR补偿校准</span>
        <button
          type="button"
          class="tpc-ur-close"
          @click="tryClose"
        >
          关闭
        </button>
      </div>
      <div class="tpc-ur-body">
        <aside class="tpc-ur-cam">
          <div class="tpc-ur-cam-view" tabindex="0" title="点击画面后可用方向键点动">
            <CameraPic object-fit="cover" />
            <TenPlusCuttingPage_CrosshairLines />
          </div>
          <TenPlusCuttingPage_CrosshairBar />
          <section class="tpc-ur-keys">
            <header class="tpc-ur-keys-head">
              <span class="tpc-ur-keys-title">键盘点动</span>
              <span class="tpc-ur-keys-hint">先点相机画面，避免焦点在输入框</span>
            </header>
            <div class="tpc-ur-key-grid">
              <div class="tpc-ur-key-cell axis-x">
                <span class="tpc-ur-kbds"><kbd>←</kbd><kbd>→</kbd></span>
                <span class="tpc-ur-key-name">X</span>
              </div>
              <div class="tpc-ur-key-cell axis-y">
                <span class="tpc-ur-kbds"><kbd>↑</kbd><kbd>↓</kbd></span>
                <span class="tpc-ur-key-name">Y</span>
              </div>
              <div class="tpc-ur-key-cell axis-z">
                <span class="tpc-ur-kbds"><kbd>PgUp</kbd><kbd>PgDn</kbd></span>
                <span class="tpc-ur-key-name">Z</span>
              </div>
              <div class="tpc-ur-key-cell axis-u">
                <span class="tpc-ur-kbds"><kbd>Ctrl</kbd><span>+</span><kbd>↑</kbd><kbd>↓</kbd></span>
                <span class="tpc-ur-key-name">U</span>
              </div>
              <div class="tpc-ur-key-cell axis-r">
                <span class="tpc-ur-kbds"><kbd>Ctrl</kbd><span>+</span><kbd>←</kbd><kbd>→</kbd></span>
                <span class="tpc-ur-key-name">R</span>
              </div>
              <div class="tpc-ur-key-cell axis-step">
                <span class="tpc-ur-kbds"><kbd>F1</kbd><span>–</span><kbd>F4</kbd></span>
                <span class="tpc-ur-key-name">步长</span>
              </div>
              <div class="tpc-ur-key-cell axis-shot">
                <span class="tpc-ur-kbds"><kbd>R</kbd></span>
                <span class="tpc-ur-key-name">点射</span>
              </div>
              <div class="tpc-ur-key-cell axis-light">
                <span class="tpc-ur-kbds"><kbd>W</kbd></span>
                <span class="tpc-ur-key-name">灯光</span>
              </div>
            </div>
          </section>
        </aside>
        <div class="tpc-ur-panel">
          <div class="tpc-ur-focus">
            <label class="tpc-ur-focus-field" title="叠加到自动计算的清晰点距离上，替代原先固定 0.38">
              <span>相机清晰误差 (mm)</span>
              <input
                v-model.number="cameraFocusError"
                type="number"
                step="0.001"
                :disabled="isSavingFocusError"
              />
            </label>
            <button
              type="button"
              class="tpc-ur-focus-save"
              :disabled="isSavingFocusError"
              @click="saveCameraFocusError"
            >
              {{ isSavingFocusError ? '保存中...' : '保存' }}
            </button>
          </div>
          <AxisCenterCalibPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpc-ur-overlay {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 28%, transparent);
  backdrop-filter: blur(28px) saturate(1.4);
  -webkit-backdrop-filter: blur(28px) saturate(1.4);
}
.tpc-ur-card {
  width: min(1280px, 96vw);
  height: min(88vh, 900px);
  display: flex;
  flex-direction: column;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI Variable Display',
    'Segoe UI',
    system-ui,
    sans-serif;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 72%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 18px;
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 35%, transparent) inset,
    0 18px 50px color-mix(in srgb, #000 16%, transparent);
  backdrop-filter: blur(40px) saturate(1.6);
  -webkit-backdrop-filter: blur(40px) saturate(1.6);
}
.tpc-ur-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--app-text-primary);
  border-bottom: 0.5px solid color-mix(in srgb, var(--app-border) 70%, transparent);
  background: color-mix(in srgb, var(--app-card) 35%, transparent);
  flex-shrink: 0;
}
.tpc-ur-close {
  border: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  background: color-mix(in srgb, var(--app-card-soft) 65%, transparent);
  color: var(--app-text-primary);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.tpc-ur-close:hover {
  border-color: var(--tpc-apple-blue, #007aff);
  color: var(--tpc-apple-blue, #007aff);
}
.tpc-ur-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tpc-ur-body {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.2fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
  padding: 12px 16px 16px;
}
.tpc-ur-cam {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.tpc-ur-cam-view {
  position: relative;
  flex: 1;
  min-height: 220px;
  overflow: hidden;
  border-radius: 8px;
  background: #0b1220;
  outline: none;
}
.tpc-ur-cam-view:focus {
  box-shadow: 0 0 0 1px #0ea5e9;
}
.tpc-ur-keys {
  flex-shrink: 0;
  padding: 8px;
  border: 0.5px solid color-mix(in srgb, #fff 35%, var(--app-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--app-card) 55%, transparent);
}
.tpc-ur-keys-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.tpc-ur-keys-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
}
.tpc-ur-keys-hint {
  min-width: 0;
  font-size: 10px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpc-ur-key-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.tpc-ur-key-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  grid-column: span 2;
  min-height: 52px;
  padding: 6px 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-input-bg);
}
.tpc-ur-key-cell.axis-shot,
.tpc-ur-key-cell.axis-light {
  grid-column: span 3;
}
.tpc-ur-kbds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.tpc-ur-kbds span {
  font-size: 10px;
  color: var(--app-text-muted);
}
.tpc-ur-keys kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--app-card) 70%, #000);
  color: var(--app-text-primary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--app-text-primary) 8%, transparent);
}
.tpc-ur-key-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}
.tpc-ur-key-cell.axis-x .tpc-ur-key-name { color: #d97706; }
.tpc-ur-key-cell.axis-y .tpc-ur-key-name { color: #16a34a; }
.tpc-ur-key-cell.axis-z .tpc-ur-key-name { color: #2563eb; }
.tpc-ur-key-cell.axis-u {
  border-color: color-mix(in srgb, #0ea5e9 35%, var(--app-border));
}
.tpc-ur-key-cell.axis-u .tpc-ur-key-name { color: #0ea5e9; }
.tpc-ur-key-cell.axis-r {
  border-color: color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-ur-key-cell.axis-r .tpc-ur-key-name { color: #f59e0b; }
.tpc-ur-key-cell.axis-step .tpc-ur-key-name,
.tpc-ur-key-cell.axis-shot .tpc-ur-key-name,
.tpc-ur-key-cell.axis-light .tpc-ur-key-name {
  color: var(--app-text-secondary);
  letter-spacing: 0.04em;
  font-weight: 600;
}
.tpc-ur-panel {
  min-height: 0;
  overflow: auto;
  color: var(--app-text-primary);
}
.tpc-ur-focus {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 0.5px solid color-mix(in srgb, #fff 35%, var(--app-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-card-soft) 62%, transparent);
}
.tpc-ur-focus-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-primary);
}
.tpc-ur-focus-field input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 13px;
}
.tpc-ur-focus-save {
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card);
  color: var(--app-text-primary);
  font-size: 12px;
  cursor: pointer;
}
.tpc-ur-focus-save:hover:not(:disabled) {
  border-color: #0ea5e9;
}
.tpc-ur-focus-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
