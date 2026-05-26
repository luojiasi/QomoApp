// ─────────────────────────────────────────────────────────────
// composables/useWorkflowList.ts
//
// SelfProcessPage_WorkflowList.vue（左侧流程列表）的交互逻辑。
// ─────────────────────────────────────────────────────────────

import { ref } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'

export function useWorkflowList() {
  const store = useWorkflowStore()

  const newName      = ref('')
  const showNewInput = ref(false)

  function startCreate(): void {
    newName.value = ''
    showNewInput.value = true
  }

  function confirmCreate(): void {
    const name = newName.value.trim()
    if (name) store.addWorkflow(name)
    showNewInput.value = false
  }

  function cancelCreate(): void {
    showNewInput.value = false
  }

  function onInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter')  confirmCreate()
    if (e.key === 'Escape') cancelCreate()
  }

  async function deleteWorkflow(id: string): Promise<void> {
    await store.removeWorkflow(id)
  }

  /** 格式化 ISO 时间为本地可读字符串 */
  function formatDate(iso: string): string {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  return {
    store,
    newName,
    showNewInput,
    startCreate,
    confirmCreate,
    cancelCreate,
    onInputKeydown,
    deleteWorkflow,
    formatDate
  }
}
