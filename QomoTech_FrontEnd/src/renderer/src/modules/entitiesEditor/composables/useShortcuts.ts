// =============================================================================
// 快捷键处理
// =============================================================================

import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { SHORTCUTS, matchShortcut } from "@/modules/entitiesEditor/utils/shortcuts"
import type { ToolMode } from "@/modules/entitiesEditor/commons/types"

export function useShortcuts() {
  const store = useEditorStore()

  function handleKeyDown(event: KeyboardEvent): boolean {
    for (const binding of SHORTCUTS) {
      if (!matchShortcut(event, binding)) continue

      event.preventDefault()

      switch (binding.action) {
        case 'UNDO': store.undo(); break
        case 'REDO': store.redo(); break
        case 'DELETE_SELECTED': store.deleteSelected(); break
        case 'FIT_VIEW': store.resetViewport(); break
        case 'SET_TOOL': {
          const tool = binding.data?.tool as ToolMode | undefined
          if (tool) store.setTool(tool)
          break
        }
        // SAVE / IMPORT / EXPORT 留给父组件通过事件处理
        default: return false
      }
      return true
    }
    return false
  }

  return { handleKeyDown }
}
