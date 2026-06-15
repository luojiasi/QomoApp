import { ref } from 'vue'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'
import { en } from './en'
import { ja } from './ja'
import { ko } from './ko'

export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

export type Messages = typeof zhCN

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
  ko
}

const STORAGE_KEY = 'qomotech:locale'

const currentLocale = ref<Locale>(
  (localStorage.getItem(STORAGE_KEY) as Locale) ?? 'zh-CN'
)

export function getLocale(): Locale {
  return currentLocale.value
}

export function setLocale(locale: Locale): void {
  currentLocale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}

export function t(path: string): string {
  const keys = path.split('.')
  let value: any = messages[currentLocale.value]
  for (const key of keys) {
    if (value == null) return path
    value = value[key]
  }
  return typeof value === 'string' ? value : path
}

export function useL10n() {
  return { t, getLocale, setLocale, currentLocale }
}
