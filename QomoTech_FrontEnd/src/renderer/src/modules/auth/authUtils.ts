import type { AuthStorage } from './authTypes'
import { AUTH_STORAGE_KEY } from '@/shared/constants/storageKeys'
import { DEFAULT_USER_ACCOUNT } from './authConfig'

export const getDefaultAuthState = (): AuthStorage => ({
  username: '',
  isAdmin: false,
  isUser: true,
  userAccount: { ...DEFAULT_USER_ACCOUNT }
})

export const loadAuthState = (): AuthStorage => {
  if (typeof window === 'undefined') return getDefaultAuthState()
  const savedState = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!savedState) return getDefaultAuthState()
  try {
    return {
      ...getDefaultAuthState(),
      ...JSON.parse(savedState)
    }
  } catch {
    return getDefaultAuthState()
  }
}
