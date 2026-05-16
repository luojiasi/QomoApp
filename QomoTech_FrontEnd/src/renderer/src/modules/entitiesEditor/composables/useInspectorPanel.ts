import { ref } from 'vue'
import type { InspectorSection } from '../shares/types'



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
