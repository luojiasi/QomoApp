import { 曲线子类型圆, 曲线路径类型 } from '../../constants/tenPlusCutting'
import type { TenPlusQuickShapeInput, TenPlusQuickShapeRowDraft } from '../../types/shapePreset'

export interface 预览点 {
  横: number
  纵: number
}

export interface 预览模型 {
  半长: number
  半宽: number
  轮廓: 预览点[]
  分段: 预览点[][]
}

export function 点列转折线(点列: 预览点[], 比例: number): string {
  return 点列.map((点) => `${点.横 * 比例},${-点.纵 * 比例}`).join(' ')
}

/** 中心圆 X 镜像：偏X 取反，起止角改为 180°−角。预览与下发草稿必须同一套。 */
export function 中心圆镜像X(
  偏X: number,
  起: number,
  止: number
): { 偏X: number; 起: number; 止: number } {
  return { 偏X: -偏X, 起: 180 - 起, 止: 180 - 止 }
}

export function 采样圆弧(
  圆心X: number,
  圆心Y: number,
  半径: number,
  起始角: number,
  结束角: number,
  点数: number
): 预览点[] {
  if (点数 < 2) return []
  const 跨度 = 结束角 - 起始角
  const 结果: 预览点[] = []
  for (let 下标 = 0; 下标 < 点数; 下标 += 1) {
    const 角度 = 起始角 + (跨度 * 下标) / (点数 - 1)
    const 弧度 = (角度 * Math.PI) / 180
    结果.push({ 横: 圆心X + 半径 * Math.cos(弧度), 纵: 圆心Y + 半径 * Math.sin(弧度) })
  }
  return 结果
}

export function 中心圆草稿(
  输入: TenPlusQuickShapeInput,
  半径: number,
  偏X: number,
  起: number,
  止: number,
  同层: boolean
): TenPlusQuickShapeRowDraft {
  return {
    pathType: 曲线路径类型,
    diameter: 半径,
    length: 输入.length,
    width: 输入.width,
    curveKind: 曲线子类型圆,
    superellipseN: 0,
    arcStart: 起,
    arcEnd: 止,
    arcOffsetX: 偏X,
    arcOffsetY: 0,
    sameLayer: 同层,
    angle: 输入.angle,
    height: 输入.height
  }
}

export function 尺寸角度错误(输入: TenPlusQuickShapeInput): string | null {
  if (!Number.isFinite(输入.length) || 输入.length <= 0) return '长必须大于 0'
  if (!Number.isFinite(输入.width) || 输入.width <= 0) return '宽必须大于 0'
  if (!Number.isFinite(输入.height) || 输入.height < 0) return '高度不能为负'
  if (!Number.isFinite(输入.angle) || 输入.angle < -90 || 输入.angle > 90) {
    return '角度必须在 -90~90 之间'
  }
  return null
}
