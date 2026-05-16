import router from '@/app/router'
import type { ActionDef } from '../../shares/types'

/**
 * 统一 action 分发入口 —— 工具栏点击 & 键盘快捷键 在此汇聚。
 *
 * 调用方传入各 action 的回调处理函数，dispatchAction 根据 action.id 路由到对应回调。
 */
export function useShortCutsDetails(handlers: {
  onSettingsOpen: () => void
}) {
  function dispatchAction(a: ActionDef) {
    switch (a.id) {
      case 'SETTINGS':
        handlers.onSettingsOpen()
        break
      case 'BACKHOME':
        router.push('/home')
        break
      // 其余 action 在 composables 重建后逐项接入
    }
  }

  return { dispatchAction }
}
