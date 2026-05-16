import { ref } from 'vue'

export type InspectorSection = 'params' | 'transform'

export interface InspectedEntity {
  id: string
  kind: string
  height: number
  openSize: number
  tiltAngleDeg: number
}

export function useInspectorPanel() {
  const activeSection = ref<InspectorSection>('params')

  return { activeSection }
}
