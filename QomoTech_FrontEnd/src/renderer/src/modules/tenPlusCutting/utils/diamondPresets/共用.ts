import {
  侧视台面比例,
  百分比最大值,
  百分比最小值,
  默认亭高比,
  默认冠高比,
  默认台面比,
  默认直径,
  默认腰高比,
  默认钻石切工,
  切工轮廓种类表,
  钻石切工选项
} from '../../constants/diamondPreset'
import { 切角比例推荐 } from '../../constants/tenPlusCutting'
import type {
  钻石侧视模型,
  钻石侧视点,
  钻石切工类型,
  钻石切工轮廓,
  钻石图层字段,
  钻石预设输入
} from '../../types/diamondPreset'

function 百分比无效(值: number): boolean {
  return !Number.isFinite(值) || 值 < 百分比最小值 || 值 > 百分比最大值
}

export function 创建默认钻石预设(): 钻石预设输入 {
  return {
    切工: 默认钻石切工,
    直径: 默认直径,
    长: 默认直径,
    宽: 默认直径,
    台面比: 默认台面比,
    冠高比: 默认冠高比,
    腰高比: 默认腰高比,
    亭高比: 默认亭高比
  }
}

export function 切工标签(切工: 钻石切工类型): string {
  return 钻石切工选项.find((项) => 项.value === 切工)?.label ?? '钻石'
}

export function 切工轮廓(切工: 钻石切工类型): 钻石切工轮廓 {
  const 种类 = 切工轮廓种类表[切工]
  if (种类 === '切角矩形') {
    const 项 = 切角比例推荐.find((推荐) => 推荐.shape === 切工)
    if (项 == null) throw new Error(`缺少${切工}的切角比例推荐`)
    return { 种类, 切角比例: 项.value }
  }
  return { 种类 }
}

export function 切工需要长宽(切工: 钻石切工类型): boolean {
  return 切工轮廓(切工).种类 !== '等分圆'
}

function 外接尺寸无效(值: number): boolean {
  return !Number.isFinite(值) || 值 <= 0 || 值 > 200
}

function 腰宽毫米(输入: 钻石预设输入): number {
  return 切工需要长宽(输入.切工) ? Number(输入.宽) : Number(输入.直径)
}

export function 钻石预设错误(输入: 钻石预设输入): string {
  const 轮廓 = 切工轮廓(输入.切工)
  if (轮廓.种类 === '等分圆') {
    if (外接尺寸无效(Number(输入.直径))) return '直径必须在 0 以上、200 以内'
  } else {
    const 长 = Number(输入.长)
    const 宽 = Number(输入.宽)
    if (外接尺寸无效(长)) return '长必须在 0 以上、200 以内'
    if (外接尺寸无效(宽)) return '宽必须在 0 以上、200 以内'
    if (轮廓.种类 === '切角矩形') {
      const 切角量 = (轮廓.切角比例 / 100) * 宽
      if (!(切角量 > 0) || 2 * 切角量 >= 长) return '切角量相对当前长宽过大，请加大长或减小宽'
    }
  }
  if (百分比无效(Number(输入.台面比))) return '台面比须在 0.1%–100% 之间'
  if (百分比无效(Number(输入.冠高比))) return '冠高比须在 0.1%–100% 之间'
  if (百分比无效(Number(输入.腰高比))) return '腰高比须在 0.1%–100% 之间'
  if (百分比无效(Number(输入.亭高比))) return '亭高比须在 0.1%–100% 之间'
  return ''
}

export function 层高毫米(直径: number, 百分比: number): number {
  return (Number(直径) * Number(百分比)) / 100
}

function 限制切角(角度: number): number {
  if (!Number.isFinite(角度) || 角度 <= 0) return 90
  return Math.min(90, Math.round(角度 * 10) / 10)
}

/** 相对台面（水平）的倾角：0 台面、90 竖直。与任务行 angle 同一套。 */
function 斜边倾角(升高: number, 水平: number): number {
  if (!(升高 > 0) || !(水平 > 0)) return 90
  return 限制切角((Math.atan(升高 / 水平) * 180) / Math.PI)
}

/**
 * 冠：atan(冠高 / ((腰宽 − 台宽) / 2))；腰：90°；亭：−atan(亭高 / 半径)。
 * 圆钻用直径；切角矩形用宽当腰宽。
 */
export function 计算钻石预设角度(输入: 钻石预设输入): Record<钻石图层字段, number> {
  const 腰宽 = 腰宽毫米(输入)
  const 半径 = 腰宽 / 2
  const 半台宽 = 半径 * (Number(输入.台面比) / 100)
  return {
    冠高比: 斜边倾角(层高毫米(腰宽, Number(输入.冠高比)), 半径 - 半台宽),
    腰高比: 90,
    亭高比: -斜边倾角(层高毫米(腰宽, Number(输入.亭高比)), 半径)
  }
}

function 多边形路径(点列: 钻石侧视点[]): string {
  if (点列.length === 0) return ''
  const 起点 = 点列[0]
  const 其余 = 点列
    .slice(1)
    .map((点) => `L${点.横.toFixed(2)} ${点.纵.toFixed(2)}`)
    .join(' ')
  return `M${起点.横.toFixed(2)} ${起点.纵.toFixed(2)} ${其余} Z`
}

/**
 * 圆钻侧视轮廓。高度用冠/腰/亭百分比，腰宽固定，台面宽按台面比（占腰宽）。
 */
export function 生成钻石侧视(冠高比: number,腰高比: number,亭高比: number,台面比: number = 默认台面比): 钻石侧视模型 {
  const 冠高 = Math.max(Number(冠高比) || 0, 0.2)
  const 腰高 = Math.max(Number(腰高比) || 0, 0.2)
  const 亭高 = Math.max(Number(亭高比) || 0, 0.2)
  const 半腰宽 = 50
  const 台面比例 = Math.min(1, Math.max(0.001, Number(台面比) / 100 || 侧视台面比例))
  const 半台宽 = 半腰宽 * 台面比例
  const 台面高度 = 0
  const 腰顶高度 = 冠高
  const 腰底高度 = 冠高 + 腰高
  const 亭尖高度 = 腰底高度 + 亭高

  const 台面左: 钻石侧视点 = { 横: -半台宽, 纵: 台面高度 }
  const 台面右: 钻石侧视点 = { 横: 半台宽, 纵: 台面高度 }
  const 腰顶左: 钻石侧视点 = { 横: -半腰宽, 纵: 腰顶高度 }
  const 腰顶右: 钻石侧视点 = { 横: 半腰宽, 纵: 腰顶高度 }
  const 腰底左: 钻石侧视点 = { 横: -半腰宽, 纵: 腰底高度 }
  const 腰底右: 钻石侧视点 = { 横: 半腰宽, 纵: 腰底高度 }
  const 亭尖: 钻石侧视点 = { 横: 0, 纵: 亭尖高度 }

  const 边距 = 6
  return {
    冠路径: 多边形路径([台面左, 台面右, 腰顶右, 腰顶左]),
    腰路径: 多边形路径([腰顶左, 腰顶右, 腰底右, 腰底左]),
    亭路径: 多边形路径([腰底左, 腰底右, 亭尖]),
    左刻面路径: 多边形路径([台面左, { 横: 0, 纵: 台面高度 }, 腰顶左]),
    刻面路径: [
      `M${(-半腰宽 * 0.34).toFixed(2)} ${腰底高度.toFixed(2)} L0 ${亭尖高度.toFixed(2)}`,
      `M${(半腰宽 * 0.34).toFixed(2)} ${腰底高度.toFixed(2)} L0 ${亭尖高度.toFixed(2)}`,
      `M0 ${台面高度.toFixed(2)} L0 ${腰顶高度.toFixed(2)}`
    ].join(' '),
    轮廓路径: 多边形路径([台面左, 台面右, 腰顶右, 腰底右, 亭尖, 腰底左, 腰顶左]),
    台面高度,
    腰顶高度,
    腰底高度,
    亭尖高度,
    半腰宽,
    视口左: -半腰宽 - 边距,
    视口上: -边距,
    视口宽: 半腰宽 * 2 + 边距 * 2,
    视口高: 亭尖高度 + 边距 * 2
  }
}
