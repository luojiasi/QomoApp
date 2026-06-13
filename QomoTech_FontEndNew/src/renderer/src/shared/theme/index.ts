export interface ThemeColors {
  '--color-background': string
  '--color-surface': string
  '--color-surface-dim': string
  '--color-surface-bright': string
  '--color-surface-container-lowest': string
  '--color-surface-container-low': string
  '--color-surface-container': string
  '--color-surface-container-high': string
  '--color-surface-container-highest': string
  '--color-on-surface': string
  '--color-on-surface-variant': string
  '--color-outline': string
  '--color-outline-variant': string
  '--color-primary': string
  '--color-on-primary': string
  '--color-primary-container': string
  '--color-on-primary-container': string
  '--color-secondary': string
  '--color-on-secondary': string
  '--color-secondary-container': string
  '--color-on-secondary-container': string
  '--color-tertiary': string
  '--color-on-tertiary': string
  '--color-tertiary-container': string
  '--color-on-tertiary-container': string
  '--color-error': string
  '--color-on-error': string
  '--color-error-container': string
  '--color-on-error-container': string
}

export interface Theme {
  id: string
  nameKey: string
  colors: ThemeColors
}

export const themes: Theme[] = [
  {
    id: 'dark-industrial',
    nameKey: 'settings.themeDarkIndustrial',
    colors: {
      '--color-background': '#10131b',
      '--color-surface': '#10131b',
      '--color-surface-dim': '#10131b',
      '--color-surface-bright': '#363942',
      '--color-surface-container-lowest': '#0b0e16',
      '--color-surface-container-low': '#181c23',
      '--color-surface-container': '#1c2027',
      '--color-surface-container-high': '#272a32',
      '--color-surface-container-highest': '#31353d',
      '--color-on-surface': '#e0e2ed',
      '--color-on-surface-variant': '#c1c6d7',
      '--color-outline': '#8b90a0',
      '--color-outline-variant': '#414754',
      '--color-primary': '#adc7ff',
      '--color-on-primary': '#002e68',
      '--color-primary-container': '#4a8eff',
      '--color-on-primary-container': '#00285b',
      '--color-secondary': '#c4c6cb',
      '--color-on-secondary': '#2e3135',
      '--color-secondary-container': '#494c50',
      '--color-on-secondary-container': '#babcc1',
      '--color-tertiary': '#ffb695',
      '--color-on-tertiary': '#571e00',
      '--color-tertiary-container': '#ef6719',
      '--color-on-tertiary-container': '#4c1a00',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
    }
  },
  {
    id: 'arctic-blue',
    nameKey: 'settings.themeArcticBlue',
    colors: {
      '--color-background': '#0a1628',
      '--color-surface': '#0a1628',
      '--color-surface-dim': '#060e1a',
      '--color-surface-bright': '#1a2d4a',
      '--color-surface-container-lowest': '#040a14',
      '--color-surface-container-low': '#0e1e36',
      '--color-surface-container': '#14243e',
      '--color-surface-container-high': '#1c3050',
      '--color-surface-container-highest': '#243c62',
      '--color-on-surface': '#d6e5ff',
      '--color-on-surface-variant': '#a3c0e8',
      '--color-outline': '#6b8ab8',
      '--color-outline-variant': '#2e4a70',
      '--color-primary': '#7cb3ff',
      '--color-on-primary': '#001a3d',
      '--color-primary-container': '#2563eb',
      '--color-on-primary-container': '#dbeafe',
      '--color-secondary': '#b8c8e0',
      '--color-on-secondary': '#1a2a40',
      '--color-secondary-container': '#3d5470',
      '--color-on-secondary-container': '#d0ddf0',
      '--color-tertiary': '#7dd3fc',
      '--color-on-tertiary': '#082f49',
      '--color-tertiary-container': '#0284c7',
      '--color-on-tertiary-container': '#e0f2fe',
      '--color-error': '#fda4af',
      '--color-on-error': '#4c0519',
      '--color-error-container': '#9f1239',
      '--color-on-error-container': '#ffe4e6'
    }
  },
  {
    id: 'emerald-forest',
    nameKey: 'settings.themeEmeraldForest',
    colors: {
      '--color-background': '#0a1a14',
      '--color-surface': '#0a1a14',
      '--color-surface-dim': '#06120e',
      '--color-surface-bright': '#1a3a2e',
      '--color-surface-container-lowest': '#040c0a',
      '--color-surface-container-low': '#0e241c',
      '--color-surface-container': '#142e24',
      '--color-surface-container-high': '#1c3e32',
      '--color-surface-container-highest': '#244e40',
      '--color-on-surface': '#d4ede4',
      '--color-on-surface-variant': '#a0cfbd',
      '--color-outline': '#6ba890',
      '--color-outline-variant': '#2e5a46',
      '--color-primary': '#6ee7b7',
      '--color-on-primary': '#003d20',
      '--color-primary-container': '#059669',
      '--color-on-primary-container': '#d1fae5',
      '--color-secondary': '#b8d8c8',
      '--color-on-secondary': '#1a3026',
      '--color-secondary-container': '#3d6650',
      '--color-on-secondary-container': '#d0f0e0',
      '--color-tertiary': '#a7f3d0',
      '--color-on-tertiary': '#064e3b',
      '--color-tertiary-container': '#047857',
      '--color-on-tertiary-container': '#ecfdf5',
      '--color-error': '#fda4af',
      '--color-on-error': '#4c0519',
      '--color-error-container': '#9f1239',
      '--color-on-error-container': '#ffe4e6'
    }
  }
]

export function applyTheme(themeId: string): void {
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value)
  }
}
