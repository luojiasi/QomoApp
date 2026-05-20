<script setup lang="ts">
import type { XYZPosition } from './useShow4PTable'

defineProps<{
  visible: boolean
  isAcquiring: boolean
  diamondCount: number
  currentDiamondIndex: number
  isCurrentAcquired: boolean
  allAcquired: boolean
  currentTablePosition: XYZPosition
  diamondPositions: Record<number, XYZPosition>
}>()

const emit = defineEmits<{
  acquire: []
  nextDiamond: []
  prevDiamond: []
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="show-4p-overlay">
    <div class="show-4p-dialog">
      <h3 class="show-4p-title">
        台面位置设置 — 钻石 {{ currentDiamondIndex + 1 }}/{{ diamondCount }}
      </h3>

      <div class="show-4p-body">
        <!-- Diamond progress dots -->
        <div class="show-4p-progress">
          <span
            v-for="i in diamondCount"
            :key="i"
            class="show-4p-dot"
            :class="{
              active: i - 1 === currentDiamondIndex,
              done: diamondPositions[i - 1] !== undefined
            }"
          >
            {{ i }}
          </span>
        </div>

        <p v-if="!isCurrentAcquired && !isAcquiring" class="show-4p-hint">
          请移动至钻石 {{ currentDiamondIndex + 1 }} 的台面位置
        </p>
        <p v-else-if="isAcquiring" class="show-4p-hint acquiring">
          正在获取台面位置...
        </p>
        <p v-else class="show-4p-hint acquired">
          钻石 {{ currentDiamondIndex + 1 }} 台面位置已获取
        </p>

        <div v-if="isCurrentAcquired" class="show-4p-position">
          <span>X: {{ currentTablePosition.x.toFixed(3) }}</span>
          <span>Y: {{ currentTablePosition.y.toFixed(3) }}</span>
          <span>Z: {{ currentTablePosition.z.toFixed(3) }}</span>
        </div>

        <!-- Summary of all diamonds -->
        <div v-if="diamondCount > 1" class="show-4p-summary">
          <div
            v-for="i in diamondCount"
            :key="i"
            class="show-4p-summary-row"
            :class="{ current: i - 1 === currentDiamondIndex }"
          >
            <span class="show-4p-summary-label">钻石 {{ i }}</span>
            <span v-if="diamondPositions[i - 1]" class="show-4p-summary-pos">
              X: {{ diamondPositions[i - 1].x.toFixed(3) }}
              &nbsp;Y: {{ diamondPositions[i - 1].y.toFixed(3) }}
              &nbsp;Z: {{ diamondPositions[i - 1].z.toFixed(3) }}
            </span>
            <span v-else class="show-4p-summary-empty">未获取</span>
          </div>
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
        <div class="show-4p-nav">
          <button
            class="show-4p-btn nav-btn"
            :disabled="currentDiamondIndex === 0"
            @click="emit('prevDiamond')"
          >
            上一颗
          </button>
          <button
            class="show-4p-btn nav-btn"
            :disabled="currentDiamondIndex >= diamondCount - 1"
            @click="emit('nextDiamond')"
          >
            下一颗
          </button>
        </div>
        <button
          class="show-4p-btn confirm-btn"
          :disabled="!allAcquired"
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
  z-index: 400;
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
  min-width: 400px;
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

.show-4p-progress {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  justify-content: center;
}

.show-4p-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--app-border);
  color: var(--app-text-secondary);
  transition: background 0.2s, color 0.2s;
}

.show-4p-dot.active {
  background: #3b82f6;
  color: #fff;
}

.show-4p-dot.done {
  background: #22c55e;
  color: #fff;
}

.show-4p-dot.active.done {
  background: #3b82f6;
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

.show-4p-summary {
  margin-top: 16px;
  border-top: 1px solid var(--app-border);
  padding-top: 12px;
}

.show-4p-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  border-radius: 4px;
  padding: 4px 8px;
}

.show-4p-summary-row.current {
  background: rgba(59, 130, 246, 0.1);
}

.show-4p-summary-label {
  font-weight: 500;
  color: var(--app-text);
  min-width: 60px;
}

.show-4p-summary-pos {
  font-family: monospace;
  color: #22c55e;
  font-size: 12px;
}

.show-4p-summary-empty {
  color: var(--app-text-secondary);
  font-style: italic;
}

.show-4p-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.show-4p-nav {
  display: flex;
  gap: 4px;
  margin-right: auto;
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

.nav-btn {
  border-color: var(--app-border);
  color: var(--app-text);
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
