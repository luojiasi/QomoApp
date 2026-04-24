import type { DiamondDetailParameters } from '@renderer/types/diamondTypes'

export const diamondQuickAddConfigs: DiamondDetailParameters[] = [
  {
    id: 'round-diamond',
    name: '圆形钻石',
    R: 3.1167,
    P: 0.5529,
    L: 5.24,
    W: 5.24,
    LW: 1.00,
    Depth: { Ratio: 62, Real: 4.0 },
    Yield: { Ratio: 22.63, Real: 2.73 },
    Pavilion: { Ratio: 41.00, Real: 2.8 },
    Crown: { Ratio: 35.4, Real: 0.94 },
    Girdle: { Ratio: 4, Real: 0.23 },
    Table: { Ratio: 58, Real: 3.71 },
    Tilt: 0,
    SW: 3.37
  },
  {
    id: 'oval-diamond',
    name: '椭圆形钻石',
    R: 3.1167,
    P: 0.6782,
    L: 6.63,
    W: 5.10,
    LW: 1.3,
    Depth: { Ratio: 63, Real: 3.84 },
    Yield: { Ratio: 27.76, Real: 2.54 },
    Pavilion: { Ratio: 40.7, Real: 2.73 },
    Crown: { Ratio: 36.4, Real: 0.87 },
    Girdle: { Ratio: 4, Real: 0.24 },
    Table: { Ratio: 56, Real: 3.6 },
    Tilt: 0,
    SW: 0
  }
]
