import {
  垫型四分弧,
  垫型指数最大,
  垫型指数最小,
  垫型旋转角
} from '../../constants/shapePreset'
import { 曲线子类型超椭圆, 曲线路径类型 } from '../../constants/tenPlusCutting'
import type { TenPlusQuickShapeInput, TenPlusQuickShapeRowDraft } from '../../types/shapePreset'
import { 尺寸角度错误, type 预览模型, type 预览点 } from './共用'

const 轮廓采样点数 = 360
const 分段采样点数 = 60

/**
 * 垫型超椭圆极径，与 test/cushion_shape.html 相同：
 * r(θ) = a·b / [ (b·|cosθ|)ⁿ + (a·|sinθ|)ⁿ ]^(1/n)
 * a、b 为半长、半宽。
 */
function 垫型极径(弧度: number, 半长: number, 半宽: number, 指数: number): number {
  const 余弦 = Math.abs(Math.cos(弧度))
  const 正弦 = Math.abs(Math.sin(弧度))
  const 分母 = (半宽 * 余弦) ** 指数 + (半长 * 正弦) ** 指数
  if (!(分母 > 0)) return 0
  return (半长 * 半宽) / 分母 ** (1 / 指数)
}

function 采样垫型弧(
  半长: number,
  半宽: number,
  指数: number,
  起始角: number,
  结束角: number,
  点数: number
): 预览点[] {
  if (点数 < 2) return []
  const 跨度 = 结束角 - 起始角
  const 结果: 预览点[] = []
  for (let 下标 = 0; 下标 < 点数; 下标 += 1) {
    const 角度 = 起始角 + (跨度 * 下标) / (点数 - 1)
    const 摆放弧度 = (角度 * Math.PI) / 180
    const 形状弧度 = ((角度 - 垫型旋转角) * Math.PI) / 180
    const 半径 = 垫型极径(形状弧度, 半长, 半宽, 指数)
    结果.push({ 横: 半径 * Math.cos(摆放弧度), 纵: 半径 * Math.sin(摆放弧度) })
  }
  return 结果
}

export function 垫型错误(输入: TenPlusQuickShapeInput): string | null {
  const 基础 = 尺寸角度错误(输入)
  if (基础) return 基础
  if (
    !Number.isFinite(输入.exponent) ||
    输入.exponent < 垫型指数最小 ||
    输入.exponent > 垫型指数最大
  ) {
    return `指数 n 必须在 ${垫型指数最小}–${垫型指数最大} 之间`
  }
  return null
}

export function 构建垫型预览(输入: TenPlusQuickShapeInput): 预览模型 | null {
  if (垫型错误(输入)) return null
  const 半长 = 输入.length / 2
  const 半宽 = 输入.width / 2
  return {
    半长,
    半宽,
    轮廓: 采样垫型弧(半长, 半宽, 输入.exponent, 0, 360, 轮廓采样点数),
    分段: 垫型四分弧.map((弧) =>
      采样垫型弧(半长, 半宽, 输入.exponent, 弧.start, 弧.end, 分段采样点数)
    )
  }
}

/** 超椭圆四分之一弧 × 4，后 3 行 sameLayer。 */
export function 生成垫型行(输入: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  const 错误 = 垫型错误(输入)
  if (错误) throw new Error(错误)

  return 垫型四分弧.map((弧, 下标) => ({
    pathType: 曲线路径类型,
    diameter: 0,
    length: 输入.length,
    width: 输入.width,
    curveKind: 曲线子类型超椭圆,
    superellipseN: 输入.exponent,
    arcStart: 弧.start,
    arcEnd: 弧.end,
    arcOffsetX: 0,
    arcOffsetY: 0,
    sameLayer: 下标 > 0,
    angle: 输入.angle,
    height: 输入.height
  }))
}
