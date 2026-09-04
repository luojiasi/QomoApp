/** 引导气泡相对高亮控件的落点 */
export type TenPlusTourPlacement = 'top' | 'bottom' | 'left' | 'right'

/** 与页面 data-tour 一一对应的单步说明 */
export interface TenPlusTourStep {
  id: string
  target: string
  title: string
  body: string
  placement: TenPlusTourPlacement
  /** 强调色，用于易误操作的开关说明 */
  accent?: 'red'
  /** 强制注意：卡片显示「重要」标记，警告句放大 */
  important?: boolean
  /** 重点警告句，显示在正文上方 */
  warning?: string
}

export interface TenPlusTourHole {
  left: number
  top: number
  width: number
  height: number
}
