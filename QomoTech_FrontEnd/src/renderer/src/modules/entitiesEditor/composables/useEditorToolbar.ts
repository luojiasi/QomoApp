import { actionsByGroup, toolTitle, type ActionDef } from '../utils/shortcuts'

export type { ActionDef }

export function useEditorToolbar() {
  const fileGroup = actionsByGroup('file')
  const shapeGroup = actionsByGroup('shape')
  const toolGroup = actionsByGroup('tool')
  const settingsGroup = actionsByGroup('settings')

  return { fileGroup, shapeGroup, toolGroup, settingsGroup, toolTitle }
}
