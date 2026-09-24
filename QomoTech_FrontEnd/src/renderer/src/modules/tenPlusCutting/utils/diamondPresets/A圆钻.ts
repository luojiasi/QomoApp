
// 测试已通过
import { 等分线段类型 } from '../../constants/tenPlusCutting'
import type { 钻石预设输入, 钻石预设行草稿, 钻石图层字段 } from '../../types/diamondPreset'
import type { TenPlusTaskRow } from '../../types/tenPlusCutting'
import { 计算钻石比例 } from '../tenPlusDiamond'

function 写入比例(草稿: 钻石预设行草稿): 钻石预设行草稿 {
  const 比例 = 计算钻石比例(草稿 as TenPlusTaskRow)
  if (比例.直径百分比 !== null) 草稿.diameterPercent = 比例.直径百分比
  if (比例.高度百分比 !== null) 草稿.heightPercent = 比例.高度百分比
  return 草稿
}

function 台面行(腰宽: number): 钻石预设行草稿 {
  return {
    pathType: 等分线段类型,
    diameter: 腰宽,
    height: 0,
    divisions: 0,
    angle: 0,
    useDiamondRatio: false,
    diamondPercent: 0,
    diameterPercent: 100,
    heightPercent: 100
  }
}

function 图层行(腰宽: number, 角度: number, 百分比: number): 钻石预设行草稿 {
  return 写入比例({
    pathType: 等分线段类型,
    diameter: 腰宽,
    height: 腰宽,
    divisions: 0,
    angle: 角度,
    useDiamondRatio: true,
    diamondPercent: 百分比,
    diameterPercent: 100,
    heightPercent: 100
  })
}

function 限制切角(角度: number): number {
  if (!Number.isFinite(角度) || 角度 <= 0) return 90
  return Math.min(90, Math.round(角度 * 10) / 10)
}
function 斜边倾角(升高: number, 水平: number): number {
  if (!(升高 > 0) || !(水平 > 0)) return 90
  return 限制切角((Math.atan(升高 / 水平) * 180) / Math.PI)
}
function 计算钻石预设角度(输入: 钻石预设输入): Record<钻石图层字段, number> {
  const 腰宽 = 输入.直径
  const 半径 = 腰宽 / 2
  const 半台宽 = 半径 * (Number(输入.台面比) / 100)
  return {
    冠高比: 斜边倾角((Number(输入.直径) * Number(输入.冠高比)) / 100, 半径 - 半台宽),
    腰高比: 90,
    亭高比: -斜边倾角((Number(输入.直径) *  Number(输入.亭高比)) / 100, 半径)
  }
}

/** 圆钻：腰棱等分圆。四行台面→冠→腰→亭。 */
export function 生成圆钻行(输入: 钻石预设输入): 钻石预设行草稿[] {
  const 腰宽 = Number(输入.直径)
  const 角度 = 计算钻石预设角度(输入)
  return [
    台面行(腰宽),
    图层行(腰宽, 角度.冠高比, Number(输入.冠高比)),
    图层行(腰宽, 角度.腰高比, Number(输入.腰高比)),
    图层行(腰宽, 角度.亭高比, Number(输入.亭高比))
  ]
}




