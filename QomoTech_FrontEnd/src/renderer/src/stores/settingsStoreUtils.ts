import { ref, watch, type Ref } from 'vue'
import type { SettingsSaveResult } from '../types/settings'
import { cloneSettings } from '../utils/settings'

export const createSettingsSaveResult = <T>(message: string, data: T): SettingsSaveResult<T> => ({
  success: true,
  message,
  data: cloneSettings(data),
  updatedAt: new Date().toISOString()
})

export interface CreatePersistedSettingsOptions<T> {
  /** localStorage key */
  storageKey: string
  /** 默认值（不会被改写，工厂内会 clone） */
  defaultValue: T
  /** 形状校验，失败时丢弃 storage 里的内容 */
  validate: (data: unknown) => data is T
  /** 字段归一化（合并默认值、夹紧范围等） */
  normalize: (data: T) => T
  /** 持久化防抖窗口（毫秒） */
  debounceMs: number
  /** load 成功的提示文案 */
  loadMessage: string
  /** saveNow 成功的提示文案 */
  saveMessage: string
  /** 写入失败的 console 标签 */
  logTag: string
}

export interface PersistedSettings<T> {
  /** 响应式状态 */
  state: Ref<T>
  /** 直接读取 localStorage 并归一化（不修改 state） */
  loadFromStorage: () => T | null
  /** 立即写入 localStorage（用于显式按钮） */
  persistNow: () => void
  /** 重新从 storage 加载到 state，并返回结果包装 */
  load: () => Promise<SettingsSaveResult<T>>
  /** 立即归一化 state、清防抖、写入 storage */
  saveNow: () => Promise<SettingsSaveResult<T>>
  /** 重置为默认值，并立即写入 storage */
  reset: () => void
}

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

/**
 * 直接从 localStorage 读取并归一化 settings，不创建响应式状态。
 * 用于无需 store 实例的纯读取场景。
 */
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

/**
 * 通用「带本地持久化的 settings」工厂。
 * 在 store 的 setup 函数内调用，把返回值挂到 store 暴露的字段上。
 *
 * 行为：
 * - 初始化时从 localStorage 读取并 normalize；缺失/损坏则用默认值
 * - state 变更经 debounce 后写回 localStorage
 * - load / saveNow 返回标准化的 SettingsSaveResult
 */
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
