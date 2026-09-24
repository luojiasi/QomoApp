import type { TenPlusQuickShapeInput, TenPlusQuickShapeRowDraft } from '../../types/shapePreset'
import { 尺寸角度错误, 中心圆草稿, 中心圆镜像X, 采样圆弧, type 预览模型 } from './共用'

const 水滴采样点数 = 90

interface 水滴几何 {
  a: number
  L: number
  cx: number
  r: number
  右尖角: number
  左尖角: number
  尖角: number
}

/** 水滴：宽=2a，长=a+L。与 test/teardrop_shape.html 同一套。 */
export function 水滴由尺寸(长: number, 宽: number): { a: number; L: number } {
  const a = 宽 / 2
  const L = 长 - a
  return { a, L }
}

export function 水滴几何公式(a: number, L: number): 水滴几何 {
  const cx = (a * a - L * L) / (2 * a)
  const r = (a * a + L * L) / (2 * a)
  const 右尖角 = (Math.atan2(-L, -cx) * 180) / Math.PI
  let 左尖角 = (Math.atan2(-L, cx) * 180) / Math.PI
  if (左尖角 < 0) 左尖角 += 360
  const 尖角 = (2 * Math.atan(Math.abs(a * a - L * L) / (2 * a * L)) * 180) / Math.PI
  return { a, L, cx, r, 右尖角, 左尖角, 尖角 }
}

export function 水滴错误(输入: TenPlusQuickShapeInput): string | null {
  const 基础 = 尺寸角度错误(输入)
  if (基础) return 基础
  const { a, L } = 水滴由尺寸(输入.length, 输入.width)
  if (!(a > 0)) return '宽必须大于 0'
  if (!(L > 0)) return '长必须大于半宽（L = 长 − 宽/2）'
  const { r } = 水滴几何公式(a, L)
  if (!(a <= 200) || !(r > 0) || r > 200) {
    return '换算后的半宽或侧弧半径超出 0~200 mm，请减小长或增大宽'
  }
  return null
}

export function 构建水滴预览(输入: TenPlusQuickShapeInput): 预览模型 | null {
  if (水滴错误(输入)) return null
  const { a, L } = 水滴由尺寸(输入.length, 输入.width)
  const 几何 = 水滴几何公式(a, L)
  const 顶 = 中心圆镜像X(0, 180, 0)
  const 右 = 中心圆镜像X(几何.cx, 0, 几何.右尖角)
  const 左 = 中心圆镜像X(-几何.cx, 几何.左尖角, 180)
  const 顶弧 = 采样圆弧(顶.偏X, 0, 几何.a, 顶.起, 顶.止, 水滴采样点数)
  const 右弧 = 采样圆弧(右.偏X, 0, 几何.r, 右.起, 右.止, 水滴采样点数)
  const 左弧 = 采样圆弧(左.偏X, 0, 几何.r, 左.起, 左.止, 水滴采样点数)
  return {
    半长: a,
    半宽: a,
    轮廓: [...顶弧, ...右弧.slice(1), ...左弧.slice(1)],
    分段: [顶弧, 右弧, 左弧]
  }
}

/** 长/宽 → a=宽/2、L=长−a；X 镜像后沿轮廓顶→左→右，后 2 行 sameLayer。 */
export function 生成水滴行(输入: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  const 错误 = 水滴错误(输入)
  if (错误) throw new Error(错误)
  const { a, L } = 水滴由尺寸(输入.length, 输入.width)
  const 几何 = 水滴几何公式(a, L)
  const 顶 = 中心圆镜像X(0, 180, 0)
  const 右 = 中心圆镜像X(几何.cx, 0, 几何.右尖角)
  const 左 = 中心圆镜像X(-几何.cx, 几何.左尖角, 180)
  return [
    中心圆草稿(输入, a, 顶.偏X, 顶.起, 顶.止, false),
    中心圆草稿(输入, 几何.r, 右.偏X, 右.起, 右.止, true),
    中心圆草稿(输入, 几何.r, 左.偏X, 左.起, 左.止, true)
  ]
}
