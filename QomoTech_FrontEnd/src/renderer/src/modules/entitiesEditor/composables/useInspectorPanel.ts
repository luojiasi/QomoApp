import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import type { SurfaceEntity, EditorEntity } from '../commons/types'

export type InspectedEntity = SurfaceEntity<EditorEntity>

export function useInspectorPanel() {
  const store = useEditorStore()

  const selectedEntity = computed<InspectedEntity | null>(() => {
    if (store.selectedIds.length === 0) return null
    return store.entities.find(e => e.id === store.selectedIds[0]) ?? null
  })

  /** 全部选中实体（用于多选批量展示/编辑） */
  const selectedEntities = computed<InspectedEntity[]>(() => {
    if (store.selectedIds.length === 0) return []
    const set = new Set(store.selectedIds)
    return store.entities.filter(e => set.has(e.id))
  })

  function updateField(field: string, value: number | boolean | string | Record<string, unknown>[], entityId?: string) {
    const id = entityId ?? selectedEntity.value?.id
    if (!id) return

    const entity = store.entities.find(e => e.id === id)
    if (!entity) return

    const dotIndex = field.indexOf('.')
    if (dotIndex !== -1) {
      const parent = field.substring(0, dotIndex)
      const child = field.substring(dotIndex + 1)
      const current = (entity as Record<string, unknown>)[parent]
      store.updateEntity(id, {
        [parent]: { ...(current as Record<string, unknown>), [child]: value },
      } as Partial<SurfaceEntity<EditorEntity>>)
    } else {
      store.updateEntity(id, { [field]: value } as Partial<SurfaceEntity<EditorEntity>>)
    }
  }

  return { selectedEntity, selectedEntities, updateField }
}
