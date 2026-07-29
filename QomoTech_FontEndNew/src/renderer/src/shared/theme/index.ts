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
  },
  // Midnight Forge — deep cobalt navy + polished steel (precision engineering)
  {
    id: 'midnight-forge',
    nameKey: 'settings.themeMidnightForge',
    colors: {
      '--color-background': '#0b1220',
      '--color-surface': '#0b1220',
      '--color-surface-dim': '#070d18',
      '--color-surface-bright': '#243044',
      '--color-surface-container-lowest': '#060a12',
      '--color-surface-container-low': '#121a2a',
      '--color-surface-container': '#182233',
      '--color-surface-container-high': '#222e42',
      '--color-surface-container-highest': '#2c3a52',
      '--color-on-surface': '#e8eef8',
      '--color-on-surface-variant': '#b4c0d4',
      '--color-outline': '#7a8aa3',
      '--color-outline-variant': '#3a465c',
      '--color-primary': '#9eb6ff',
      '--color-on-primary': '#0a1f55',
      '--color-primary-container': '#3d63d9',
      '--color-on-primary-container': '#e8eeff',
      '--color-secondary': '#c5cedc',
      '--color-on-secondary': '#232a38',
      '--color-secondary-container': '#3f4a5c',
      '--color-on-secondary-container': '#d7deea',
      '--color-tertiary': '#a8d4ff',
      '--color-on-tertiary': '#003352',
      '--color-tertiary-container': '#2b6f9e',
      '--color-on-tertiary-container': '#e3f2ff',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
    }
  },
  // Astro Noir — cinematic near-black + amber beacon
  {
    id: 'astro-noir',
    nameKey: 'settings.themeAstroNoir',
    colors: {
      '--color-background': '#08090c',
      '--color-surface': '#08090c',
      '--color-surface-dim': '#050608',
      '--color-surface-bright': '#2a2e38',
      '--color-surface-container-lowest': '#040507',
      '--color-surface-container-low': '#111318',
      '--color-surface-container': '#171a21',
      '--color-surface-container-high': '#22262f',
      '--color-surface-container-highest': '#2d323d',
      '--color-on-surface': '#f1f5f9',
      '--color-on-surface-variant': '#c8ced8',
      '--color-outline': '#8b929e',
      '--color-outline-variant': '#3d4350',
      '--color-primary': '#ffc14d',
      '--color-on-primary': '#3d2500',
      '--color-primary-container': '#c98500',
      '--color-on-primary-container': '#fff3d6',
      '--color-secondary': '#d0d4dc',
      '--color-on-secondary': '#2a2e36',
      '--color-secondary-container': '#454a55',
      '--color-on-secondary-container': '#e2e6ee',
      '--color-tertiary': '#ffd78a',
      '--color-on-tertiary': '#3d2a00',
      '--color-tertiary-container': '#a66d00',
      '--color-on-tertiary-container': '#fff4d8',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
    }
  },
  // Quantum Teal — cool aquatic tech / analytics
  {
    id: 'quantum-teal',
    nameKey: 'settings.themeQuantumTeal',
    colors: {
      '--color-background': '#041f2a',
      '--color-surface': '#041f2a',
      '--color-surface-dim': '#03161e',
      '--color-surface-bright': '#1e3f4e',
      '--color-surface-container-lowest': '#021018',
      '--color-surface-container-low': '#0a2836',
      '--color-surface-container': '#0f3140',
      '--color-surface-container-high': '#163c4e',
      '--color-surface-container-highest': '#1e485c',
      '--color-on-surface': '#e6fffb',
      '--color-on-surface-variant': '#a8d5ce',
      '--color-outline': '#6a9e96',
      '--color-outline-variant': '#2f5550',
      '--color-primary': '#2dd4bf',
      '--color-on-primary': '#003730',
      '--color-primary-container': '#0d9488',
      '--color-on-primary-container': '#e6fffb',
      '--color-secondary': '#b8cdd4',
      '--color-on-secondary': '#1a3038',
      '--color-secondary-container': '#3a506b',
      '--color-on-secondary-container': '#d7e8ef',
      '--color-tertiary': '#67e8f9',
      '--color-on-tertiary': '#00363f',
      '--color-tertiary-container': '#0891b2',
      '--color-on-tertiary-container': '#e0f7ff',
      '--color-error': '#fda4af',
      '--color-on-error': '#4c0519',
      '--color-error-container': '#9f1239',
      '--color-on-error-container': '#ffe4e6'
    }
  },
  // Lunar Chrome — brushed aluminum + teal signal
  {
    id: 'lunar-chrome',
    nameKey: 'settings.themeLunarChrome',
    colors: {
      '--color-background': '#0f172a',
      '--color-surface': '#0f172a',
      '--color-surface-dim': '#0a1120',
      '--color-surface-bright': '#2a3548',
      '--color-surface-container-lowest': '#080e1a',
      '--color-surface-container-low': '#152033',
      '--color-surface-container': '#1b273a',
      '--color-surface-container-high': '#253247',
      '--color-surface-container-highest': '#303e54',
      '--color-on-surface': '#f4f7ff',
      '--color-on-surface-variant': '#b7c0cc',
      '--color-outline': '#94a3b8',
      '--color-outline-variant': '#3d4a5e',
      '--color-primary': '#5eead4',
      '--color-on-primary': '#00382f',
      '--color-primary-container': '#14b8a6',
      '--color-on-primary-container': '#ecfdf8',
      '--color-secondary': '#c9d2de',
      '--color-on-secondary': '#252e3c',
      '--color-secondary-container': '#475569',
      '--color-on-secondary-container': '#e2e8f0',
      '--color-tertiary': '#93c5fd',
      '--color-on-tertiary': '#0c2d55',
      '--color-tertiary-container': '#3b82f6',
      '--color-on-tertiary-container': '#eff6ff',
      '--color-error': '#fda4af',
      '--color-on-error': '#4c0519',
      '--color-error-container': '#9f1239',
      '--color-on-error-container': '#ffe4e6'
    }
  },
  // Carbon Gold — carbon black + champagne gold (luxury industrial)
  {
    id: 'carbon-gold',
    nameKey: 'settings.themeCarbonGold',
    colors: {
      '--color-background': '#0e0e10',
      '--color-surface': '#0e0e10',
      '--color-surface-dim': '#09090b',
      '--color-surface-bright': '#2c2a26',
      '--color-surface-container-lowest': '#070708',
      '--color-surface-container-low': '#161513',
      '--color-surface-container': '#1c1b18',
      '--color-surface-container-high': '#272520',
      '--color-surface-container-highest': '#333029',
      '--color-on-surface': '#f5f0e6',
      '--color-on-surface-variant': '#d0c8b8',
      '--color-outline': '#9a9180',
      '--color-outline-variant': '#484338',
      '--color-primary': '#e8c57a',
      '--color-on-primary': '#3a2a08',
      '--color-primary-container': '#b8913a',
      '--color-on-primary-container': '#fff6df',
      '--color-secondary': '#d4cfc4',
      '--color-on-secondary': '#2e2b24',
      '--color-secondary-container': '#4a453c',
      '--color-on-secondary-container': '#ebe4d6',
      '--color-tertiary': '#f0d9a8',
      '--color-on-tertiary': '#3d2f10',
      '--color-tertiary-container': '#8a6a28',
      '--color-on-tertiary-container': '#fff3d4',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
    }
  },
  // Graphite Copper — warm factory steel + copper accent
  {
    id: 'graphite-copper',
    nameKey: 'settings.themeGraphiteCopper',
    colors: {
      '--color-background': '#121110',
      '--color-surface': '#121110',
      '--color-surface-dim': '#0c0b0a',
      '--color-surface-bright': '#322e2b',
      '--color-surface-container-lowest': '#090808',
      '--color-surface-container-low': '#1c1917',
      '--color-surface-container': '#221f1c',
      '--color-surface-container-high': '#2e2a26',
      '--color-surface-container-highest': '#3a3530',
      '--color-on-surface': '#f5f0eb',
      '--color-on-surface-variant': '#d0c4ba',
      '--color-outline': '#9a8d82',
      '--color-outline-variant': '#4a423c',
      '--color-primary': '#f0a070',
      '--color-on-primary': '#3d1800',
      '--color-primary-container': '#c45f28',
      '--color-on-primary-container': '#fff0e6',
      '--color-secondary': '#d4cbc3',
      '--color-on-secondary': '#2e2924',
      '--color-secondary-container': '#4d4640',
      '--color-on-secondary-container': '#ebe3db',
      '--color-tertiary': '#ffb38a',
      '--color-on-tertiary': '#3d1600',
      '--color-tertiary-container': '#a04a1c',
      '--color-on-tertiary-container': '#ffe8d8',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
    }
  },
  // Obsidian Violet — deep ink + soft orchid (premium night UI)
  {
    id: 'obsidian-violet',
    nameKey: 'settings.themeObsidianViolet',
    colors: {
      '--color-background': '#100e16',
      '--color-surface': '#100e16',
      '--color-surface-dim': '#0a0910',
      '--color-surface-bright': '#2e2a3c',
      '--color-surface-container-lowest': '#08070c',
      '--color-surface-container-low': '#18141f',
      '--color-surface-container': '#1e1a28',
      '--color-surface-container-high': '#2a2436',
      '--color-surface-container-highest': '#362f44',
      '--color-on-surface': '#f3effa',
      '--color-on-surface-variant': '#cdc4db',
      '--color-outline': '#968eaa',
      '--color-outline-variant': '#453e56',
      '--color-primary': '#c4b5fd',
      '--color-on-primary': '#2e1065',
      '--color-primary-container': '#7c3aed',
      '--color-on-primary-container': '#f5f3ff',
      '--color-secondary': '#d0c9dc',
      '--color-on-secondary': '#2c2736',
      '--color-secondary-container': '#4a4358',
      '--color-on-secondary-container': '#e8e2f2',
      '--color-tertiary': '#f0abfc',
      '--color-on-tertiary': '#4a044e',
      '--color-tertiary-container': '#a21caf',
      '--color-on-tertiary-container': '#fce7ff',
      '--color-error': '#ffb4ab',
      '--color-on-error': '#690005',
      '--color-error-container': '#93000a',
      '--color-on-error-container': '#ffdad6'
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
