// 通过一些计算然后给到runner

import { useEditorStore } from '../stores/editorStore'

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function exportEntitiesWithCalculated() {
    const editorStore = useEditorStore()
    const entities = deepClone(editorStore.entities)
    return entities
}