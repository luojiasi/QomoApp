<script setup lang="ts">
import type { XYZPosition } from './useShow4PTable'

defineProps<{
  visible: boolean
  isAcquiring: boolean
  isAcquired: boolean
  tablePosition: XYZPosition
}>()

const emit = defineEmits<{
  acquire: []
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="show-4p-overlay">
    <div class="show-4p-dialog">
      <h3 class="show-4p-title">台面位置设置</h3>

      <div class="show-4p-body">
        <p v-if="!isAcquired && !isAcquiring" class="show-4p-hint">
          等待获取台面位置
        </p>
        <p v-else-if="isAcquiring" class="show-4p-hint acquiring">
          正在获取台面位置...
        </p>
        <p v-else class="show-4p-hint acquired">
          台面位置已获取
        </p>

        <div v-if="isAcquired" class="show-4p-position">
          <span>X: {{ tablePosition.x.toFixed(3) }}</span>
          <span>Y: {{ tablePosition.y.toFixed(3) }}</span>
          <span>Z: {{ tablePosition.z.toFixed(3) }}</span>
        </div>
      </div>

      <div class="show-4p-actions">
        <button
          class="show-4p-btn acquire-btn"
          :disabled="isAcquiring"
          @click="emit('acquire')"
        >
          获取XYZ坐标
        </button>
        <button
          class="show-4p-btn confirm-btn"
          :disabled="!isAcquired"
          @click="emit('confirm')"
        >
          完成
        </button>
        <button class="show-4p-btn cancel-btn" @click="emit('cancel')">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.show-4p-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.show-4p-dialog {
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 24px;
  min-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  pointer-events: auto;
}

.show-4p-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}

.show-4p-body {
  margin-bottom: 20px;
}

.show-4p-hint {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--app-text-secondary);
}
.show-4p-hint.acquiring {
  color: #3b82f6;
}
.show-4p-hint.acquired {
  color: #22c55e;
}

.show-4p-position {
  display: flex;
  gap: 16px;
  font-size: 14px;
  font-family: monospace;
  color: var(--app-text);
}

.show-4p-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.show-4p-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  color: var(--app-text);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.show-4p-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.acquire-btn {
  border-color: #3b82f6;
  color: #3b82f6;
}

.confirm-btn {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.cancel-btn {
  border-color: var(--app-border);
  color: var(--app-text-secondary);
}
</style>
