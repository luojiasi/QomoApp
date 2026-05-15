<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { useShortcuts } from "@/modules/entitiesEditor/composables/useShortcuts"
import { useDxfImport } from "@/modules/entitiesEditor/composables/useDxfImport"
import { useLjsIO } from "@/modules/entitiesEditor/composables/useLjsIO"
import EditorToolbar from "@/modules/entitiesEditor/components/EditorToolbar.vue"
import Canvas2D from "@/modules/entitiesEditor/components/Canvas2D.vue"
import Preview3D from "@/modules/entitiesEditor/components/Preview3D.vue"
import EntityInspector from "@/modules/entitiesEditor/components/EntityInspector.vue"
import LayerPanel from "@/modules/entitiesEditor/components/LayerPanel.vue"
import StatusBar from "@/modules/entitiesEditor/components/StatusBar.vue"
import type { EditorAction } from "@/modules/entitiesEditor/commons/types"

const store = useEditorStore()
const { handleKeyDown } = useShortcuts()
const { parseDxf } = useDxfImport()
const { serialize, deserialize, download } = useLjsIO()

const toolbarRef = ref<InstanceType<typeof EditorToolbar> | null>(null)

function dispatchAction(action: EditorAction) {
  switch (action.type) {
    case 'IMPORT_DXF': promptDxfImport(); break
    case 'IMPORT_LJS': promptLjsImport(); break
    case 'EXPORT_LJS': exportLjs(action.projectName); break
    case 'SAVE': saveLjs(action.projectName); break
    default:
      // 其余 action 由 useShortcuts 内部处理
      break
  }
}

function onGlobalKeyDown(event: KeyboardEvent) {
  handleKeyDown(event)
  toolbarRef.value?.handleKeyDown(event)
}

function promptDxfImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.dxf'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = parseDxf(text)
    store.replaceAllEntities(result.entities)
    // 合并图层
    for (const layer of result.layers) {
      if (!store.layers.find((l) => l.id === layer.id)) {
        store.createLayer(layer.name)
      }
    }
    store.projectMeta.sourceFileName = file.name
    store.projectMeta.unsupportedCount = result.unsupportedEntities
  }
  input.click()
}

function promptLjsImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ljs,.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    deserialize(text)
  }
  input.click()
}

function saveLjs(name?: string) {
  const n = name ?? store.projectMeta.name ?? 'Untitled'
  const json = serialize(n)
  download(n, json)
}

function exportLjs(name: string) {
  saveLjs(name)
}
</script>

<template>
  <div class="editor-page" @keydown="onGlobalKeyDown" tabindex="0">
    <EditorToolbar ref="toolbarRef" />

    <div class="main-area">
      <aside class="left-panel">
        <LayerPanel />
      </aside>

      <main class="center-panel">
        <div class="canvas-wrap">
          <Canvas2D />
        </div>
        <div class="preview-wrap">
          <Preview3D />
        </div>
      </main>

      <aside class="right-panel">
        <EntityInspector />
      </aside>
    </div>

    <StatusBar />
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #09090b;
  color: #d4d4d8;
  outline: none;
}
.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.left-panel {
  width: 180px;
  border-right: 1px solid #27272a;
  overflow-y: auto;
}
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.canvas-wrap {
  flex: 3;
  min-height: 0;
}
.preview-wrap {
  flex: 2;
  min-height: 0;
  border-top: 1px solid #27272a;
}
.right-panel {
  width: 220px;
  border-left: 1px solid #27272a;
  overflow-y: auto;
}
</style>
