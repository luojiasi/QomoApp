import { actionsByGroup, toolTitle } from '../utils/shortcuts'
import type { ActionDef } from '../shares/types'

export type { ActionDef }

export function useEditorToolbar() {
  const fileGroup = actionsByGroup('file')
  const shapeGroup = actionsByGroup('shape')
  const toolGroup = actionsByGroup('tool')
  const settingsGroup = actionsByGroup('settings')

  return { fileGroup, shapeGroup, toolGroup, settingsGroup, toolTitle }
}
