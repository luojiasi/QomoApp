// 通过一些计算然后给到runner

import { useEditorStore } from '../stores/editorStore'
import { sortLinesAndAttachNodeForExport } from './entityNodes'
import type { SurfaceEntity, EditorEntity } from '../commons/types'

export function exportEntitiesWithCalculated(): SurfaceEntity<EditorEntity>[] {
    const editorStore = useEditorStore()
    return sortLinesAndAttachNodeForExport(editorStore.entities) as SurfaceEntity<EditorEntity>[]
}