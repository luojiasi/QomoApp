<script setup lang="ts">
import type { XYZPosition } from './useShow4PTable'

defineProps<{
  visible: boolean
  isAcquiring: boolean
  positioningCount: number
  currentPositioningIndex: number
  isCurrentCenterAcquired: boolean
  isCurrentTableAcquired: boolean
  allAcquired: boolean
  currentCenterPosition: XYZPosition
  currentTablePosition: XYZPosition
  centerPositions: Record<number, XYZPosition>
  tablePositions: Record<number, XYZPosition>
}>()

const emit = defineEmits<{
  acquireCenter: []
  acquireTable: []
  nextPosition: []
  prevPosition: []
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="show-4p-overlay">
    <div class="show-4p-dialog">
      <h3 class="show-4p-title">
        定位 — 目标 {{ currentPositioningIndex + 1 }}/{{ positioningCount }}
      </h3>

      <div class="show-4p-body">
        <!-- Progress dots -->
        <div class="show-4p-progress">
          <span
            v-for="i in positioningCount"
            :key="i"
            class="show-4p-dot"
            :class="{
              active: i - 1 === currentPositioningIndex,
              done: centerPositions[i - 1] !== undefined && tablePositions[i - 1] !== undefined
            }"
          >
            {{ i }}
          </span>
        </div>

        <!-- Hint: center not acquired -->
        <p v-if="!isCurrentCenterAcquired && !isAcquiring" class="show-4p-hint">
          步骤 1/2：请移动至目标 {{ currentPositioningIndex + 1 }} 的中心点位置
        </p>
        <!-- Hint: center acquired, table not acquired -->
        <p v-else-if="isCurrentCenterAcquired && !isCurrentTableAcquired && !isAcquiring" class="show-4p-hint">
          步骤 2/2：请移动至目标 {{ currentPositioningIndex + 1 }} 的台面位置
        </p>
        <p v-else-if="isAcquiring" class="show-4p-hint acquiring">
          正在获取位置...
        </p>
        <p v-else class="show-4p-hint acquired">
          目标 {{ currentPositioningIndex + 1 }} 中心点和台面已获取
        </p>

        <div v-if="isCurrentCenterAcquired || isCurrentTableAcquired" class="show-4p-position">
          <div v-if="isCurrentCenterAcquired" class="show-4p-pos-group">
            <span class="show-4p-pos-label">中心</span>
            <span>X: {{ currentCenterPosition.x.toFixed(3) }}</span>
            <span>Y: {{ currentCenterPosition.y.toFixed(3) }}</span>
            <span>Z: {{ currentCenterPosition.z.toFixed(3) }}</span>
          </div>
          <div v-if="isCurrentTableAcquired" class="show-4p-pos-group">
            <span class="show-4p-pos-label">台面</span>
            <span>X: {{ currentTablePosition.x.toFixed(3) }}</span>
            <span>Y: {{ currentTablePosition.y.toFixed(3) }}</span>
            <span>Z: {{ currentTablePosition.z.toFixed(3) }}</span>
          </div>
        </div>

        <!-- Summary of all positions -->
        <div v-if="positioningCount >= 1" class="show-4p-summary">
          <div
            v-for="i in positioningCount"
            :key="i"
            class="show-4p-summary-row"
            :class="{ current: i - 1 === currentPositioningIndex }"
          >
            <span class="show-4p-summary-label">目标 {{ i }}</span>
            <div class="show-4p-summary-status">
              <span v-if="centerPositions[i - 1]" class="show-4p-status-tag center-done">中心 ✓</span>
              <span v-else class="show-4p-status-tag center-pending">中心 -</span>
              <span v-if="tablePositions[i - 1]" class="show-4p-status-tag table-done">台面 ✓</span>
              <span v-else class="show-4p-status-tag table-pending">台面 -</span>
            </div>
            <button
              v-if="centerPositions[i - 1] === undefined && i - 1 === currentPositioningIndex"
              class="show-4p-btn center-btn"
              :disabled="isAcquiring"
              @click="emit('acquireCenter')"
            >
              确定中心点
            </button>
          </div>
        </div>
      </div>

      <div class="show-4p-actions">
        <button
          class="show-4p-btn acquire-btn"
          :disabled="isAcquiring || !isCurrentCenterAcquired || isCurrentTableAcquired"
          @click="emit('acquireTable')"
        >
          获取XYZ坐标
        </button>
        <div class="show-4p-nav">
          <button
            class="show-4p-btn nav-btn"
            :disabled="currentPositioningIndex === 0"
            @click="emit('prevPosition')"
          >
            上一个
          </button>
          <button
            class="show-4p-btn nav-btn"
            :disabled="currentPositioningIndex >= positioningCount - 1"
            @click="emit('nextPosition')"
          >
            下一个
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

.show-4p-pos-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.show-4p-pos-label {
  font-weight: 600;
  color: #3b82f6;
}

.show-4p-status-tag {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
}

.center-done {
  color: #22c55e;
}

.center-pending {
  color: var(--app-text-secondary);
}

.table-done {
  color: #22c55e;
}

.table-pending {
  color: var(--app-text-secondary);
}

.center-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #3b82f6;
  background: transparent;
  color: #3b82f6;
  cursor: pointer;
  white-space: nowrap;
}
.center-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
