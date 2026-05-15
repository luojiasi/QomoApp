import type { DiamondDetailParameters } from '../common'

export const diamondQuickAddConfigs: DiamondDetailParameters[] = [
  {
    id: 'Diamond_round',
    name: '圆形钻石',
    type: 'diamond',
    R: 3.1167,
    P: 0.5529,
    L: 6,
    W: 6,
    LW: 1.00,
    Depth: { Ratio: 62, Real: 3.7 },
    Yield: 22.63,
    Pavilion: { Ratio: 43.5, Real: 41 },
    Crown: { Ratio: 14.7, Real: 35 },
    Girdle: { Ratio: 4, Real: 0.24 },
    Table: { Ratio: 58, Real: 3.48 },
    Tilt: 0,
    SW: 3.37
  },
  {
    id: 'Diamond_oval',
    name: '椭圆钻石',
    type: 'diamond',
    R: 3.1167,
    P: 0.6782,
    L: 6.63,
    W: 5.10,
    LW: 1.3,
    Depth: { Ratio: 63, Real: 3.84 },
    Yield: 27.76,
    Pavilion: { Ratio: 40.7, Real: 2.73 },
    Crown: { Ratio: 36.4, Real: 0.87 },
    Girdle: { Ratio: 4, Real: 0.24 },
    Table: { Ratio: 56, Real: 3.6 },
    Tilt: 0,
    SW: 0
  }
]
