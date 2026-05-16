<script setup lang="ts">
import SwitchableView from '../shares/SwitchableView.vue'
import ShortcutEditor from './panels/ShortcutEditor.vue'
import Scene3DPanel from './panels/Scene3DPanel.vue'
import GeneralPanel from './panels/GeneralPanel.vue'
import { useSettings } from '../composables/useSettings'
import { useShortcutSettings } from '../composables/shortcuts/useShortcutSettings'
import { useScene3DSettings } from '../composables/preview/useScene3DSettings'
import { useGeneralSettings } from '../composables/canvas/useGeneralSettings'
import { saveSceneConfig } from '../stores/preview3dStore'
import { saveGeneralConfig } from '../stores/generalSettingsStore'
import { useEditorStore } from '../stores/editorStore'

const { isOpen, activeTab, settingsTabs, open, close } = useSettings()
const shortcuts = useShortcutSettings()
const scene3D = useScene3DSettings()
const general = useGeneralSettings()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

defineExpose({
  open: () => {
    shortcuts.reload()
    open()
  },
  close,
})

function onKeydown(e: KeyboardEvent) {
  if (shortcuts.capturing.value) {
    shortcuts.handleCapture(e)
    return
  }
  if (e.key === 'Escape') {
    if (shortcuts.capturing.value) {
      shortcuts.cancelCapture()
    } else {
      close()
    }
  }
}

function save() {
  shortcuts.save()
  saveSceneConfig(scene3D.toData())
  const generalData = general.toData()
  saveGeneralConfig(generalData)
  // 同步项目名到当前项目的 meta
  const store = useEditorStore()
  store.projectMeta.name = generalData.defaultProjectName
  emit('saved')
  close()
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
              :actions="shortcuts.editingActions.value"
              :capturing="shortcuts.capturing.value"
              @start-capture="shortcuts.startCapture"
              @cancel-capture="shortcuts.cancelCapture"
              @clear="shortcuts.clearAction"
              @reset="shortcuts.resetAction"
            />
            <Scene3DPanel
              v-else-if="activeTab === 'scene3d'"
              :form="scene3D.form"
              @update:form="(patch) => Object.assign(scene3D.form, patch)"
              @reset="scene3D.reset"
            />
            <GeneralPanel
              v-else-if="activeTab === 'general'"
              :form="general.form"
              @update:form="(patch) => Object.assign(general.form, patch)"
              @reset="general.reset"
            />
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
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
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
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sd-body :deep(.switchable-view) {
  flex: 1;
  min-height: 0;
  height: 100%;
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
