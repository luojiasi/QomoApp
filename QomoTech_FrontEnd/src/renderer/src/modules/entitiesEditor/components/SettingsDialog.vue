<script setup lang="ts">
import SwitchableView from '../shares/SwitchableView.vue'
import ShortcutEditor from './panels/ShortcutEditor.vue'
import { useSettings } from '../composables/useSettings'

const {
  isOpen,
  activeTab,
  settingsTabs,
  editingActions,
  capturing,
  close,
  save,
  startCapture,
  cancelCapture,
  handleCapture,
  clearAction,
  resetAction,
} = useSettings()

defineExpose({ open: () => { isOpen.value = true }, close })

function onKeydown(e: KeyboardEvent) {
  if (capturing.value) {
    handleCapture(e)
    return
  }
  if (e.key === 'Escape') {
    if (capturing.value) {
      cancelCapture()
    } else {
      close()
    }
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="settings-overlay" @click.self="close" @keydown="onKeydown" tabindex="-1">
      <div class="settings-dialog">
        <div class="sd-header">
          <span class="sd-title">设置</span>
          <button class="sd-close" @click="close">✕</button>
        </div>
        <div class="sd-body">
          <SwitchableView v-model="activeTab" :tabs="settingsTabs">
            <ShortcutEditor
              v-if="activeTab === 'shortcuts'"
              :actions="editingActions"
              :capturing="capturing"
              @start-capture="startCapture"
              @cancel-capture="cancelCapture"
              @clear="clearAction"
              @reset="resetAction"
            />
            <div v-else class="sd-placeholder">
              <span>通用设置（待开发）</span>
            </div>
          </SwitchableView>
        </div>
        <div class="sd-footer">
          <button class="sd-btn cancel" @click="close">取消</button>
          <button class="sd-btn save" @click="save">保存</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.settings-dialog {
  width: 560px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #131316;
  border: 1px solid #27272a;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.sd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.sd-title { font-size: 15px; font-weight: 600; color: #e4e4e7; }
.sd-close {
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
}
.sd-close:hover { color: #e4e4e7; background: #27272a; }
.sd-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sd-body :deep(.switchable-view) {
  border-left: none;
  background: transparent;
}
.sd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}
.sd-btn {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.sd-btn.cancel {
  background: #27272a;
  color: #a1a1aa;
}
.sd-btn.cancel:hover { background: #3f3f46; color: #e4e4e7; }
.sd-btn.save {
  background: #3b82f6;
  color: #fff;
}
.sd-btn.save:hover { background: #2563eb; }
.sd-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #52525b;
  font-size: 13px;
}

/* modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .settings-dialog,
.modal-leave-active .settings-dialog {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .settings-dialog {
  transform: scale(0.95) translateY(8px);
}
.modal-leave-to .settings-dialog {
  transform: scale(0.95) translateY(8px);
}
</style>
