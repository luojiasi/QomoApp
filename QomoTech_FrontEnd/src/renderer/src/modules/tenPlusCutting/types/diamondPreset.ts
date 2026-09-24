import type { TenPlusTaskRow } from './tenPlusCutting'

/** 钻石快捷形状里当前能生成任务行的切工。与 钻石切工选项 一致。 */
export type 钻石切工类型 = '圆钻' | '公主方' | '祖母绿' | '雷迪恩'

/** 切工落到哪一种任务路径。椭圆/心形未接入前不要往这里加种类。 */
export type 钻石轮廓种类 = '等分圆' | '切角矩形'

export type 钻石切工轮廓 =
  | { 种类: '等分圆' }
  | { 种类: '切角矩形'; 切角比例: number }

/** 冠 / 腰 / 亭 百分比字段名 */
export type 钻石图层字段 = '冠高比' | '腰高比' | '亭高比'

/** 钻石快捷形状：类型 + 圆钻直径或切角矩形长宽 + 台面/冠/腰/亭百分比 */
export interface 钻石预设输入 {
  切工: 钻石切工类型
  直径: number
  长: number
  宽: number
  台面比: number
  冠高比: number
  腰高比: number
  亭高比: number
}

/** 钻石比例换算结果；null 表示算不出来，调用方不写回任务行 */
export interface 钻石比例结果 {
  直径百分比: number | null
  高度百分比: number | null
}

/** 生成任务行时要覆盖的字段；id / taskNo 由 store 分配，字段名跟任务行走 */
export type 钻石预设行草稿 = Pick<
  TenPlusTaskRow,
  | 'pathType'
  | 'diameter'
  | 'height'
  | 'divisions'
  | 'angle'
  | 'useDiamondRatio'
  | 'diamondPercent'
  | 'diameterPercent'
  | 'heightPercent'
> &
  Partial<Pick<TenPlusTaskRow, 'length' | 'width' | 'cornerRatio'>>

/** 侧视轮廓上的一点 */
export interface 钻石侧视点 {
  横: number
  纵: number
}

/** 圆钻侧视：台面 → 冠 → 腰 → 亭尖 */
export interface 钻石侧视模型 {
  冠路径: string
  腰路径: string
  亭路径: string
  左刻面路径: string
  刻面路径: string
  轮廓路径: string
  台面高度: number
  腰顶高度: number
  腰底高度: number
  亭尖高度: number
  半腰宽: number
  视口左: number
  视口上: number
  视口宽: number
  视口高: number
}
