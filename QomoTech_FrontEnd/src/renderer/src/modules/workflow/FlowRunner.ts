import { useSelfProcessStore } from './useSelfProcessStore'

/**
 * FlowRunner 组合式函数
 * 预留执行引擎接口，当前执行引擎已清空
 */
export function useFlowRunner() {
  const store = useSelfProcessStore()

  return {
    store
  }
}
