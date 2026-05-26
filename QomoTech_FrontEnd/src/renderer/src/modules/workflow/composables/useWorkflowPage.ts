// ─────────────────────────────────────────────────────────────
// composables/useWorkflowPage.ts
//
// SelfProcessPage.vue 的初始化逻辑。
// 职责：页面挂载时加载数据，仅此而已。
// ─────────────────────────────────────────────────────────────

import { onMounted } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'

export function useWorkflowPage() {
  const store = useWorkflowStore()

  onMounted(async () => {
    await store.init()
  })

  return { store }
}
