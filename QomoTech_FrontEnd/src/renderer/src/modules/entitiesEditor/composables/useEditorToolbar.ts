import { shallowRef } from 'vue'
import type { ActionDef, ActionGroup } from '../shares/types'
import { getResolvedActions } from '../stores/shortcutsStore'
import { toolTitle } from '../utils/shortcuts'

function groupBy(actions: ActionDef[], group: ActionGroup): ActionDef[] {
  return actions.filter(a => a.group === group)
}

export function useEditorToolbar() {
  const fileGroup = shallowRef<ActionDef[]>([])
  const shapeGroup = shallowRef<ActionDef[]>([])
  const toolGroup = shallowRef<ActionDef[]>([])
  const settingsGroup = shallowRef<ActionDef[]>([])

  function reload() {
    const resolved = getResolvedActions()
    fileGroup.value = groupBy(resolved, 'file')
    shapeGroup.value = groupBy(resolved, 'shape')
    toolGroup.value = groupBy(resolved, 'tool')
    settingsGroup.value = groupBy(resolved, 'settings')
  }
  reload()

  return { fileGroup, shapeGroup, toolGroup, settingsGroup, toolTitle, reload }
}
