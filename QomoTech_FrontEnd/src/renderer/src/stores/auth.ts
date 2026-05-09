import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AccountInfo, AuthStorage, LoginResult } from '../types/auth'
import { AUTH_STORAGE_KEY } from '../configs/storageKeys'
import { DEFAULT_ADMIN_ACCOUNT, DEFAULT_USER_ACCOUNT } from '../configs/settings'

const getDefaultAuthState = (): AuthStorage => ({username: '',isAdmin: false,isUser: true,userAccount: { ...DEFAULT_USER_ACCOUNT }})

const loadAuthState = (): AuthStorage => {
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

export const useAuthStore = defineStore('auth', () => {
  const savedState = loadAuthState()
  const username = ref(savedState.username)
  const isAdmin = ref(savedState.isAdmin)
  const isUser = ref(savedState.isUser)
  const userAccount = ref<AccountInfo>({ ...savedState.userAccount })

  const isLoggedIn = computed(() => username.value.trim().length > 0)

  const saveAuthState = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        username: username.value,
        isAdmin: isAdmin.value,
        isUser: isUser.value,
        userAccount: userAccount.value
      })
    )
  }

  const login = (name: string, password: string): LoginResult => {
    const normalizedName = name.trim()
    const normalizedPassword = password.trim()

    if (
      normalizedName === DEFAULT_ADMIN_ACCOUNT.username &&
      normalizedPassword === DEFAULT_ADMIN_ACCOUNT.password
    ) {
      username.value = normalizedName
      isAdmin.value = true
      isUser.value = false
      saveAuthState()

      return {
        success: true,
        message: '管理员登录成功'
      }
    }

    if (
      normalizedName === userAccount.value.username &&
      normalizedPassword === userAccount.value.password
    ) {
      username.value = normalizedName
      isAdmin.value = false
      isUser.value = true
      saveAuthState()

      return {
        success: true,
        message: '用户登录成功'
      }
    }

    return {
      success: false,
      message: '用户名或密码不正确'
    }
  }

  const updateUserAccount = (name: string, password: string): LoginResult => {
    const normalizedName = name.trim()
    const normalizedPassword = password.trim()

    if (!normalizedName || !normalizedPassword) {
      return {
        success: false,
        message: '用户名和密码不能为空'
      }
    }

    userAccount.value = {
      username: normalizedName,
      password: normalizedPassword
    }
    saveAuthState()

    return {
      success: true,
      message: '用户账号已更新并保存到本地'
    }
  }

  const logout = () => {
    username.value = ''
    isAdmin.value = false
    isUser.value = true
    saveAuthState()
  }

  return {
    username,
    isAdmin,
    isUser,
    userAccount,
    adminAccount: DEFAULT_ADMIN_ACCOUNT,
    isLoggedIn,
    login,
    updateUserAccount,
    logout
  }
})
