import type { 钻石切工类型, 钻石轮廓种类 } from '../types/diamondPreset'

export const 钻石切工选项: ReadonlyArray<{ value: 钻石切工类型; label: string }> = [
  { value: '圆钻', label: '圆钻' },
  { value: '公主方', label: '公主方' },
  { value: '祖母绿', label: '祖母绿' },
  { value: '雷迪恩', label: '雷迪恩' }
]

/** 切工 → 轮廓种类。与 钻石切工选项 必须同键；生成任务行只认这里。 */
export const 切工轮廓种类表: Record<钻石切工类型, 钻石轮廓种类> = {
  圆钻: '等分圆',
  公主方: '等分圆',
  祖母绿: '切角矩形',
  雷迪恩: '切角矩形'
}

export const 默认钻石切工: 钻石切工类型 = '圆钻'

/** 与用户示例一致：直径 6，台面 55%，冠 16%，腰 6%，亭 65% */
export const 默认直径 = 4
export const 默认台面比 = 48
export const 默认冠高比 = 12.5
export const 默认腰高比 = 7
export const 默认亭高比 = 48

export const 百分比最小值 = 0.1
export const 百分比最大值 = 100

/** 侧视台面宽占腰宽的默认比例（圆钻常见台宽约 55%） */
export const 侧视台面比例 = 默认台面比 / 100
