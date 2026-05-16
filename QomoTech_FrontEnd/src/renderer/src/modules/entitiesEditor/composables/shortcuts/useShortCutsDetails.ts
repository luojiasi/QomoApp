import router from '@/app/router'
import type { ActionDef } from '../../shares/types'
import { lastShortcut } from '../useStatusBar'
import { toolTitle } from '../../utils/shortcuts'

/**
 * 统一 action 分发入口 —— 工具栏点击 & 键盘快捷键 在此汇聚。
 *
 * 调用方传入各 action 的回调处理函数，dispatchAction 根据 action.id 路由到对应回调。
 */
export function useShortCutsDetails(handlers: {
  onSettingsOpen: () => void
  onToggleGrid: () => void
  onToggleAxes: () => void
}) {
  function dispatchAction(a: ActionDef) {
    lastShortcut.value = toolTitle(a)
    switch (a.id) {
      case 'SETTINGS':
        handlers.onSettingsOpen()
        break
      case 'BACKHOME':
        router.back()
        break
      case 'TOGGLE_GRID':
        handlers.onToggleGrid()
        break
      case 'TOGGLE_AXES':
        handlers.onToggleAxes()
        break
    }
  }

  return { dispatchAction }
}
