import { ref, watch, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { ReservePageDefinition, SettingsSaveResult } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'

// 原 configs/settings.ts 的备用页面定义
export const reservePageDefinitions: ReservePageDefinition[] = [
  {
    id: 'help',
    path: '/help',
    title: '帮助界面',
    description: '原 Home 页面内容已迁移到该页面，用于集中展示授权、账号和管理员维护操作。',
    readyFor: ['授权信息总览', '账号维护', '管理员密钥操作']
  },
  {
    id: 'detailed-rs232-send',
    path: '/detailed-rs232-send',
    title: '详细RS232数据发送区',
    description: '用于配置串口参数、编辑发送帧内容与预留 RS232 接口联调。',
    readyFor: ['串口参数配置（COM1～COM10）', '发送/接收数据区', '快捷命令与接口联调说明']
  },
  {
    id: 'reserve-c',
    path: '/reserve-workbench-c',
    title: '备用界面 C',
    description: '建议承接系统工具、维护助手、日志审计类组件。',
    readyFor: ['系统维护工具', '调试日志查询', '权限与审计']
  }
]

// ─── 通用工具 ───────────────────────────────────────

export const createSettingsSaveResult = <T>(message: string, data: T): SettingsSaveResult<T> => ({
  success: true,
  message,
  data: cloneSettings(data),
  updatedAt: new Date().toISOString()
})

export interface CreatePersistedSettingsOptions<T> {
  storageKey: string
  defaultValue: T
  validate: (data: unknown) => data is T
  normalize: (data: T) => T
  debounceMs: number
  loadMessage: string
  saveMessage: string
  logTag: string
}

export interface PersistedSettings<T> {
  state: Ref<T>
  loadFromStorage: () => T | null
  persistNow: () => void
  load: () => Promise<SettingsSaveResult<T>>
  saveNow: () => Promise<SettingsSaveResult<T>>
  reset: () => void
}

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

export function readSettingsFromStorage<T>(
  storageKey: string,
  validate: (data: unknown) => data is T,
  normalize: (data: T) => T
): T | null {
  if (!canUseLocalStorage()) return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!validate(parsed)) return null
    return normalize(parsed)
  } catch {
    return null
  }
}

export function createPersistedSettings<T>(
  options: CreatePersistedSettingsOptions<T>
): PersistedSettings<T> {
  const { storageKey, defaultValue, validate, normalize, debounceMs, loadMessage, saveMessage, logTag } = options

  const loadFromStorage = (): T | null => readSettingsFromStorage(storageKey, validate, normalize)

  const persistToStorage = (value: T): void => {
    if (!canUseLocalStorage()) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      console.warn(`[${logTag}] 写入 localStorage 失败`, e)
    }
  }

  const state = ref<T>(loadFromStorage() ?? cloneSettings(defaultValue)) as Ref<T>

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const clearPersistTimer = (): void => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
  }
  const schedulePersist = (): void => {
    clearPersistTimer()
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistToStorage(state.value)
    }, debounceMs)
  }

  watch(state, schedulePersist, { deep: true, flush: 'post' })

  const persistNow = (): void => {
    clearPersistTimer()
    persistToStorage(state.value)
  }

  const load = async (): Promise<SettingsSaveResult<T>> => {
    const fromStorage = loadFromStorage()
    if (fromStorage) {
      state.value = cloneSettings(fromStorage)
    }
    return createSettingsSaveResult(loadMessage, state.value)
  }

  const saveNow = async (): Promise<SettingsSaveResult<T>> => {
    clearPersistTimer()
    state.value = cloneSettings(normalize(state.value))
    persistToStorage(state.value)
    return createSettingsSaveResult(saveMessage, state.value)
  }

  const reset = (): void => {
    clearPersistTimer()
    state.value = cloneSettings(defaultValue)
    persistToStorage(state.value)
  }

  return { state, loadFromStorage, persistNow, load, saveNow, reset }
}

// ─── 备用页面 Store ─────────────────────────────────

export const useReservePagesStore = defineStore('reserve-pages', () => {
  const reservePages = ref<ReservePageDefinition[]>(cloneSettings(reservePageDefinitions))

  const loadReservePages = async (): Promise<SettingsSaveResult<ReservePageDefinition[]>> =>
    createSettingsSaveResult('备用界面占位接口已加载。', reservePages.value)

  return {
    reservePages,
    loadReservePages
  }
})
