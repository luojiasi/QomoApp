import type { TenPlusQuickShapeInput, TenPlusQuickShapeRowDraft } from '../../types/shapePreset'
import { 尺寸角度错误, 中心圆草稿, 中心圆镜像X, 采样圆弧, type 预览模型 } from './共用'

const 马眼采样点数 = 90

/** 与 test/marquise_shape.html 同一套：半长 l、半宽 w。 */
interface 马眼几何 {
  l: number
  w: number
  R: number
  d: number
  半张角: number
}

/** 马眼：总长=2l、总宽=2w。与 test/marquise_shape.html 同一套。 */
export function 马眼几何公式(半长: number, 半宽: number): 马眼几何 {
  const R = (半长 * 半长 + 半宽 * 半宽) / (2 * 半宽)
  const d = (半长 * 半长 - 半宽 * 半宽) / (2 * 半宽)
  const 半张角 = (Math.atan2(半长, d) * 180) / Math.PI
  return { l: 半长, w: 半宽, R, d, 半张角 }
}

export function 马眼错误(输入: TenPlusQuickShapeInput): string | null {
  const 基础 = 尺寸角度错误(输入)
  if (基础) return 基础
  const { R } = 马眼几何公式(输入.length / 2, 输入.width / 2)
  if (!(R > 0) || R > 200) {
    return '换算后的圆弧半径超出 0~200 mm，请减小长或增大宽'
  }
  return null
}

export function 构建马眼预览(输入: TenPlusQuickShapeInput): 预览模型 | null {
  if (马眼错误(输入)) return null
  const 几何 = 马眼几何公式(输入.length / 2, 输入.width / 2)
  const 左 = 中心圆镜像X(-几何.d, -几何.半张角, 几何.半张角)
  const 右 = 中心圆镜像X(几何.d, 180 - 几何.半张角, 180 + 几何.半张角)
  const 左弧 = 采样圆弧(左.偏X, 0, 几何.R, 左.起, 左.止, 马眼采样点数)
  const 右弧 = 采样圆弧(右.偏X, 0, 几何.R, 右.起, 右.止, 马眼采样点数)
  return {
    半长: 几何.l,
    半宽: 几何.w,
    轮廓: [...左弧, ...右弧.slice(1)],
    分段: [左弧, 右弧]
  }
}

/** 长/宽 → 半长 l、半宽 w；两段等半径中心圆，X 镜像后左弧→右弧，第 2 行 sameLayer。 */
export function 生成马眼行(输入: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  const 错误 = 马眼错误(输入)
  if (错误) throw new Error(错误)
  const 几何 = 马眼几何公式(输入.length / 2, 输入.width / 2)
  const 左 = 中心圆镜像X(-几何.d, -几何.半张角, 几何.半张角)
  const 右 = 中心圆镜像X(几何.d, 180 - 几何.半张角, 180 + 几何.半张角)
  return [
    中心圆草稿(输入, 几何.R, 左.偏X, 左.起, 左.止, false),
    中心圆草稿(输入, 几何.R, 右.偏X, 右.起, 右.止, true)
  ]
}
