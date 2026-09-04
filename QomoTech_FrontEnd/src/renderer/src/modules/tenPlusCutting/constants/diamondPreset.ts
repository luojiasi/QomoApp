import type { TenPlusDiamondCutId } from '../types/diamondPreset'

export const TEN_PLUS_DIAMOND_CUT_OPTIONS: ReadonlyArray<{
  value: TenPlusDiamondCutId
  label: string
}> = [
  { value: 'round', label: '圆钻' },
  { value: 'oval', label: '椭圆形' },
  { value: 'princess', label: '公主方' },
  { value: 'emerald', label: '祖母绿' },
  { value: 'radiant', label: '雷迪恩' },
  { value: 'heart', label: '心形' }
]

export const TEN_PLUS_DEFAULT_DIAMOND_CUT: TenPlusDiamondCutId = 'round'

/** 与用户示例一致：直径 6，冠 16%，腰 6%，亭 65% */
export const TEN_PLUS_DEFAULT_DIAMOND_PRESET_DIAMETER = 6
export const TEN_PLUS_DEFAULT_DIAMOND_PRESET_CROWN = 16
export const TEN_PLUS_DEFAULT_DIAMOND_PRESET_GIRDLE = 6
export const TEN_PLUS_DEFAULT_DIAMOND_PRESET_PAVILION = 65

export const TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN = 0.1
export const TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX = 100

/** 侧视台面宽占腰宽的比例（圆钻常见台宽约 55%） */
export const TEN_PLUS_DIAMOND_PROFILE_TABLE_RATIO = 0.55
