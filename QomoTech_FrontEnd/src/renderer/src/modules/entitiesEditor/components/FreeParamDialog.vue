<script setup lang="ts">
import { useFreeParamDialog } from '../composables/useFreeParamDialog'

const { isOpen, open, close } = useFreeParamDialog()

defineExpose({ open, close })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="freeparam-overlay" @click.self="close" @keydown="onKeydown" tabindex="-1">
      <div class="freeparam-dialog">
        <div class="fp-header">
          <span class="fp-title">自由编辑参数</span>
          <button class="fp-close" @click="close">✕</button>
        </div>
        <div class="fp-body">
          <!-- 占位：弹窗内容待编辑 -->
        </div>
        <div class="fp-footer">
          <button class="fp-btn cancel" @click="close">取消</button>
          <button class="fp-btn save" @click="close">保存</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.freeparam-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.freeparam-dialog {
  width: 560px;
  max-width: 90vw;
  max-height: 80vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: #131316;
  border: 1px solid #27272a;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.fp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.fp-title { font-size: 15px; font-weight: 600; color: #e4e4e7; }
.fp-close {
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
}
.fp-close:hover { color: #e4e4e7; background: #27272a; }
.fp-body {
  min-height: 200px;
  padding: 16px;
  overflow-y: auto;
  color: #71717a;
  font-size: 13px;
}
.fp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}
.fp-btn {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.fp-btn.cancel {
  background: #27272a;
  color: #a1a1aa;
}
.fp-btn.cancel:hover { background: #3f3f46; color: #e4e4e7; }
.fp-btn.save {
  background: #3b82f6;
  color: #fff;
}
.fp-btn.save:hover { background: #2563eb; }

/* modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .freeparam-dialog,
.modal-leave-active .freeparam-dialog {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .freeparam-dialog {
  transform: scale(0.95) translateY(8px);
}
.modal-leave-to .freeparam-dialog {
  transform: scale(0.95) translateY(8px);
}
</style>
