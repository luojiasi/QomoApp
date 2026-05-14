import { ref, watch, type Ref } from 'vue'
import type { SettingsSaveResult } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'


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
