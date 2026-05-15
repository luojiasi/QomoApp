import type { HomeState } from '../types'
import { HOME_STATE_KEY } from '@/shared/constants/storageKeys'
import { isBrowser } from '@/shared/utils/browser'

/** 从 localStorage 加载回零状态。无数据时返回默认状态。 */
export function loadHomeState(): HomeState {
  if (!isBrowser()) {
    return { ISARRIVEDHOME: false, AUTO_HOME_ON_START: false }
  }
  try {
    const raw = window.localStorage.getItem(HOME_STATE_KEY)
    if (!raw) {
      const legacyIsArrived = window.localStorage.getItem('ISARRIVEDHOME') === 'true'
      return { ISARRIVEDHOME: legacyIsArrived, AUTO_HOME_ON_START: false }
    }
    const parsed = JSON.parse(raw) as Partial<HomeState>
    return {
      ISARRIVEDHOME: Boolean(parsed.ISARRIVEDHOME),
      AUTO_HOME_ON_START: Boolean(parsed.AUTO_HOME_ON_START)
    }
  } catch {
    return { ISARRIVEDHOME: false, AUTO_HOME_ON_START: false }
  }
}

/** 保存回零状态到 localStorage。 */
export function saveHomeState(value: HomeState): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(HOME_STATE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[home-state] 写入 localStorage 失败', e)
  }
}
