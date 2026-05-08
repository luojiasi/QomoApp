const STORAGE_KEY = 'qomo-ui-theme'

function getResolvedTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'light' || explicit === 'dark') {
    return explicit
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 启动时调用：若有本地保存则应用，避免跟随系统与保存不一致 */
export function applySavedTheme(): void {
  if (typeof document === 'undefined') return
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved)
  }
}

/** 在浅色 / 深色之间切换并写入 localStorage */
export function toggleColorScheme(): void {
  const next = getResolvedTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(STORAGE_KEY, next)
}
