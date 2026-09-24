import { computed, reactive, ref } from 'vue'
import {文件扩展名,文件格式,文件版本,默认弦长倍率,默认结束切割百分比,默认起始切割百分比,默认R圈数,默认直径百分比,默认高度百分比,默认钻石百分比,默认切角比例,默认线长,默认线宽,默认弧起点,默认弧终点,默认弧偏移,默认超椭圆指数,默认曲线子类型,默认路径类型,台面锁定默认值,解析曲线子类型,解析路径类型,是台面角,是非等分直线,是曲线,是超椭圆曲线} from '../constants/tenPlusCutting'
import { 垫型指数最大, 垫型指数最小 } from '../constants/shapePreset'
import type { SerializedTenPlusTargets, TenPlusTarget, TenPlusTaskRow } from '../types/tenPlusCutting'

let 序号 = 0
function 下一编号(前缀: string): string {
  序号 += 1
  return `${前缀}-${Date.now()}-${序号}`
}

function 限制切削百分比(原始: unknown, 回退: number): number {
  const 数值 = Number(原始)
  if (!Number.isFinite(数值)) return 回退
  return Math.min(100, Math.max(0, 数值))
}

function 创建任务行(任务序号: number): TenPlusTaskRow {
  return {
    id: 下一编号('task'),
    taskNo: 任务序号,
    pathType: 默认路径类型,
    diameter: 0,
    length: 默认线长,
    width: 默认线宽,
    cornerRatio: 默认切角比例,
    arcStart: 默认弧起点,
    arcEnd: 默认弧终点,
    arcOffsetX: 默认弧偏移,
    arcOffsetY: 默认弧偏移,
    curveKind: 默认曲线子类型,
    superellipseN: 默认超椭圆指数,
    sameLayer: false,
    angle: 90,
    height: 0,
    divisions: 12,
    recipe: '',
    compAngle: 0,
    diameterPercent: 默认直径百分比,
    heightPercent: 默认高度百分比,
    cutStartPercent: 默认起始切割百分比,
    cutEndPercent: 默认结束切割百分比,
    useDiamondRatio: false,
    diamondPercent: 默认钻石百分比,
    chordRatio: 默认弦长倍率,
    rTurns: 默认R圈数,
    k: 0,
    b: 0,
    x: 0
  }
}

function 创建目标(名称: string): TenPlusTarget {
  return {
    id: 下一编号('target'),
    name: 名称,
    pointXyz: '',
    oppositeCut: false,
    slotIndex: null,
    十轴切割R旋转圈数: 0,
    十轴切割R旋转补偿值: 0,
    rows: [创建任务行(1)]
  }
}

function 规范化工位序号(原始: unknown): number | null {
  if (原始 === null || 原始 === undefined || 原始 === '') return null
  const 数值 = Number(原始)
  if (!Number.isInteger(数值) || 数值 < 1 || 数值 > 10) return null
  return 数值
}

export function 应用台面锁定字段(任务行: TenPlusTaskRow): void {
  Object.assign(任务行, 台面锁定默认值)
}

function 规范化任务行(原始: Partial<TenPlusTaskRow>, 回退序号: number): TenPlusTaskRow {
  const 角度 = Number(原始.angle ?? 90)
  const 超椭圆指数 = Number.isFinite(Number(原始.superellipseN))
    ? Number(原始.superellipseN)
    : 默认超椭圆指数
  const 任务行: TenPlusTaskRow = {
    id: 原始.id || 下一编号('task'),
    taskNo: 原始.taskNo ?? 回退序号,
    pathType: 解析路径类型(原始.pathType),
    diameter: Number(原始.diameter ?? 0),
    length: Number(原始.length ?? 默认线长),
    width: Number(原始.width ?? 默认线宽),
    cornerRatio: Number.isFinite(Number(原始.cornerRatio))
      ? Number(原始.cornerRatio)
      : 默认切角比例,
    arcStart: Number.isFinite(Number(原始.arcStart))
      ? Number(原始.arcStart)
      : 默认弧起点,
    arcEnd: Number.isFinite(Number(原始.arcEnd)) ? Number(原始.arcEnd) : 默认弧终点,
    arcOffsetX: Number.isFinite(Number(原始.arcOffsetX))
      ? Number(原始.arcOffsetX)
      : 默认弧偏移,
    arcOffsetY: Number.isFinite(Number(原始.arcOffsetY))
      ? Number(原始.arcOffsetY)
      : 默认弧偏移,
    curveKind: 解析曲线子类型(原始.curveKind, 超椭圆指数),
    superellipseN: 超椭圆指数,
    sameLayer: 原始.sameLayer === true,
    angle: 角度,
    height: Number(原始.height ?? 0),
    divisions: Number(原始.divisions ?? 12),
    recipe: typeof 原始.recipe === 'string' ? 原始.recipe : '',
    compAngle: Number(原始.compAngle ?? 0),
    diameterPercent: Number.isFinite(Number(原始.diameterPercent))
      ? Number(原始.diameterPercent)
      : 默认直径百分比,
    heightPercent: Number.isFinite(Number(原始.heightPercent))
      ? Number(原始.heightPercent)
      : 默认高度百分比,
    cutStartPercent: 限制切削百分比(原始.cutStartPercent, 默认起始切割百分比),
    cutEndPercent: 限制切削百分比(原始.cutEndPercent, 默认结束切割百分比),
    useDiamondRatio: 原始.useDiamondRatio === true,
    diamondPercent: Number.isFinite(Number(原始.diamondPercent))
      ? Number(原始.diamondPercent)
      : 默认钻石百分比,
    chordRatio: Number(原始.chordRatio ?? 默认弦长倍率),
    rTurns:
      Number.isFinite(Number(原始.rTurns)) && Number(原始.rTurns) > 0
        ? Number(原始.rTurns)
        : 默认R圈数,
    k: Number(原始.k ?? 0),
    b: Number(原始.b ?? 0),
    x: Number(原始.x ?? 0)
  }
  if (任务行.cutEndPercent < 任务行.cutStartPercent) 任务行.cutEndPercent = 任务行.cutStartPercent
  if (是台面角(角度)) 应用台面锁定字段(任务行)
  return 任务行
}

function 解析点位(原始: Partial<TenPlusTarget>): string {
  return typeof 原始.pointXyz === 'string' ? 原始.pointXyz.trim() : ''
}

function 解析对切(原始: unknown): boolean {
  if (typeof 原始 === 'boolean') return 原始
  return true
}

function 规范化目标(原始: Partial<TenPlusTarget>, 回退名称: string): TenPlusTarget {
  const 原始行 = Array.isArray(原始.rows) ? 原始.rows : []
  const 行列表 =
    原始行.length > 0 ? 原始行.map((行, 下标) => 规范化任务行(行, 下标 + 1)) : [创建任务行(1)]
  行列表.forEach((行, 下标) => {
    行.taskNo = 下标 + 1
  })
  return {
    id: 原始.id || 下一编号('target'),
    name: (原始.name && String(原始.name).trim()) || 回退名称,
    pointXyz: 解析点位(原始),
    oppositeCut: 解析对切(原始.oppositeCut),
    slotIndex: 规范化工位序号(原始.slotIndex),
    十轴切割R旋转圈数:
      typeof 原始.十轴切割R旋转圈数 === 'number' && !Number.isNaN(原始.十轴切割R旋转圈数)
        ? Number(原始.十轴切割R旋转圈数)
        : 0,
    十轴切割R旋转补偿值:
      typeof 原始.十轴切割R旋转补偿值 === 'number' && !Number.isNaN(原始.十轴切割R旋转补偿值)
        ? Number(原始.十轴切割R旋转补偿值)
        : 0,
    rows: 行列表
  }
}

const 目标列表 = reactive<TenPlusTarget[]>([])
const 当前目标编号 = ref<string | null>(null)

export function 使用十加任务() {
  const 当前目标 = computed(() => {
    const 编号 = 当前目标编号.value
    if (!编号) return undefined
    return 目标列表.find((项) => 项.id === 编号)
  })

  const 任务行列表 = computed(() => 当前目标.value?.rows ?? [])

  function 初始化默认目标(默认名称 = '目标 1'): void {
    if (目标列表.length > 0) return
    const 首个 = 创建目标(默认名称)
    目标列表.push(首个)
    当前目标编号.value = 首个.id
  }

  function 新建目标(名称?: string): TenPlusTarget {
    const 下一序号 = 目标列表.length + 1
    const 目标 = 创建目标(名称?.trim() || `目标 ${下一序号}`)
    目标列表.push(目标)
    当前目标编号.value = 目标.id
    return 目标
  }

  function 选择目标(编号: string): void {
    if (!目标列表.some((项) => 项.id === 编号)) return
    当前目标编号.value = 编号
  }

  function 重命名目标(编号: string, 名称: string): void {
    const 命中 = 目标列表.find((项) => 项.id === 编号)
    if (!命中) return
    const 新名称 = 名称.trim()
    if (!新名称) return
    命中.name = 新名称
  }

  function 删除目标(编号: string): void {
    if (目标列表.length <= 1) return
    const 下标 = 目标列表.findIndex((项) => 项.id === 编号)
    if (下标 < 0) return
    目标列表.splice(下标, 1)
    if (当前目标编号.value === 编号) {
      当前目标编号.value = 目标列表[Math.max(0, 下标 - 1)]?.id ?? 目标列表[0]?.id ?? null
    }
  }

  function 添加任务行(): void {
    const 目标 = 当前目标.value
    if (!目标) return
    const 下一任务号 =
      目标.rows.length > 0 ? Math.max(...目标.rows.map((行) => 行.taskNo)) + 1 : 1
    目标.rows.push(创建任务行(下一任务号))
  }

  /** 用草稿追加到当前目标末尾 */
  function 追加任务草稿(草稿列表: Array<Partial<TenPlusTaskRow>>): void {
    const 目标 = 当前目标.value
    if (!目标 || 草稿列表.length === 0) return
    const 起始 = 目标.rows.length
    目标.rows.push(
      ...草稿列表.map((草稿, 下标) =>
        规范化任务行({ ...创建任务行(起始 + 下标 + 1), ...草稿 }, 起始 + 下标 + 1)
      )
    )
    目标.rows.forEach((行, 下标) => {
      行.taskNo = 下标 + 1
    })
  }

  function 删除任务行(行编号: string): void {
    const 目标 = 当前目标.value
    if (!目标) return
    const 下标 = 目标.rows.findIndex((行) => 行.id === 行编号)
    if (下标 < 0) return
    if (目标.rows.length <= 1) return
    目标.rows.splice(下标, 1)
    目标.rows.forEach((行, 下标) => {
      行.taskNo = 下标 + 1
    })
  }

  function 绑定当前目标到工位(工位序号: number, 点位?: string): boolean {
    const 目标 = 当前目标.value
    if (!目标) return false
    const 下标 = 规范化工位序号(工位序号)
    if (下标 === null) return false
    for (const 项 of 目标列表) {
      if (项.id !== 目标.id && 项.slotIndex === 下标) {
        项.slotIndex = null
      }
    }
    目标.slotIndex = 下标
    if (typeof 点位 === 'string') {
      目标.pointXyz = 点位
    }
    return true
  }

  function 导出文件(文件名?: string): void {
    const 数据: SerializedTenPlusTargets = {
      format: 文件格式,
      version: 文件版本,
      savedAt: new Date().toISOString(),
      activeTargetId: 当前目标编号.value,
      targets: JSON.parse(JSON.stringify(目标列表)) as TenPlusTarget[]
    }
    const 文本 = JSON.stringify(数据, null, 2)
    const 下载名 = 文件名 || `free_param_targets${文件扩展名}`
    const 二进制 = new Blob([文本], { type: 'application/json;charset=utf-8' })
    const 地址 = URL.createObjectURL(二进制)
    const 链接 = document.createElement('a')
    链接.href = 地址
    链接.download = 下载名
    document.body.appendChild(链接)
    链接.click()
    document.body.removeChild(链接)
    URL.revokeObjectURL(地址)
  }

  function 从文件加载(json字符串: string): boolean {
    try {
      const 解析结果 = JSON.parse(json字符串) as Partial<SerializedTenPlusTargets>

      if (解析结果.format === 文件格式 && Array.isArray(解析结果.targets)) {
        const 下一批 = 解析结果.targets.map((项, 下标) => 规范化目标(项, `目标 ${下标 + 1}`))
        if (下一批.length === 0) return false
        目标列表.splice(0, 目标列表.length, ...下一批)
        const 偏好编号 = 解析结果.activeTargetId
        当前目标编号.value =
          偏好编号 && 下一批.some((项) => 项.id === 偏好编号) ? 偏好编号 : 下一批[0].id
        return true
      }

      return false
    } catch {
      return false
    }
  }

  return {
    目标列表,
    当前目标编号,
    当前目标,
    任务行列表,
    初始化默认目标,
    新建目标,
    选择目标,
    重命名目标,
    删除目标,
    添加任务行,
    追加任务草稿,
    删除任务行,
    绑定当前目标到工位,
    导出文件,
    从文件加载
  }
}

export function 直径无效(值: number): boolean {
  const 数值 = Number(值)
  return Number.isNaN(数值) || 数值 < 0 || 数值 > 200
}

export function 超椭圆指数无效(指数: number): boolean {
  const 数值 = Number(指数)
  return !Number.isFinite(数值) || 数值 < 垫型指数最小 || 数值 > 垫型指数最大
}

export function 角度无效(值: number): boolean {
  return Number.isNaN(值) || 值 < -90 || 值 > 90
}

export function 高度无效(值: number): boolean {
  return Number.isNaN(值) || 值 < 0 || 值 > 20
}

/** 台面行（角度为 0）直径不能为 0。 */
export function 台面直径为零(直径: number, 角度: number): boolean {
  return 是台面角(角度) && Number(直径) === 0
}

/** 非台面行高度不能为 0。 */
export function 非台面高度为零(高度: number, 角度: number): boolean {
  return !是台面角(角度) && Number(高度) === 0
}

export function 分割数无效(值: number): boolean {
  if (Number.isNaN(值)) return true
  if (值 === 0) return false
  return 值 < 3 || 值 > 360
}

/**
 * 切角比例校验：0–50% 之间，且切掉的量不能吃穿长边。
 * 切角量 c = 切角比例% × 宽，需同时满足 2c < 宽（等价于比例 < 50%）与 2c < 长。
 */
export function 切角比例无效(切角比例: number, 长: number, 宽: number): boolean {
  const 比例 = Number(切角比例)
  if (!Number.isFinite(比例) || 比例 <= 0 || 比例 >= 50) return true
  const 切角量 = (比例 / 100) * Number(宽)
  return !(切角量 > 0) || 2 * 切角量 >= Number(长)
}

export function 弧角无效(起点: number, 终点: number): boolean {
  if (!Number.isFinite(起点) || !Number.isFinite(终点)) return true
  if (起点 < -360 || 起点 > 360 || 终点 < -360 || 终点 > 360) return true
  return 起点 === 终点
}

export function 配方无效(配方: string): boolean {return !配方}

export function 校验目标行(targetName: string, rows: TenPlusTaskRow[]): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const at = `${targetName} #${row.taskNo}`
    if (是非等分直线(row.pathType)) {
      if (直径无效(row.length)) return `${at}: 长必须在 0~200 之间`
      if (直径无效(row.width)) return `${at}: 宽必须在 0~200 之间`
      if (切角比例无效(row.cornerRatio, row.length, row.width)) {
        return `${at}: 切角比例须在 0~50% 之间，且切角量不得超过长的一半`
      }
    } else if (是曲线(row.pathType)) {
      if (是超椭圆曲线(row.pathType, row.curveKind, row.superellipseN)) {
        if (直径无效(row.length) || Number(row.length) <= 0) return `${at}: 长必须在 0 以上、200 以内`
        if (直径无效(row.width) || Number(row.width) <= 0) return `${at}: 宽必须在 0 以上、200 以内`
        if (超椭圆指数无效(row.superellipseN)) {
          return `${at}: 指数 n 须在 ${垫型指数最小}–${垫型指数最大} 之间`
        }
      } else if (直径无效(row.diameter) || Number(row.diameter) <= 0) {
        return `${at}: 半径必须在 0 以上、200 以内`
      }
      if (弧角无效(row.arcStart, row.arcEnd)) {
        return `${at}: 起始角与结束角须在 ±360° 内且不能相同`
      }
      if (row.sameLayer) {
        if (i === 0) return `${at}: 首行不能勾选同层`
        if (是台面角(row.angle)) return `${at}: 台面行不能勾选同层`
        const prev = rows[i - 1]
        if (!prev || prev.angle !== row.angle) {
          return `${at}: 同层行的角度必须与上一行相同`
        }
      }
    } else {
      if (直径无效(row.diameter) || 台面直径为零(row.diameter, row.angle)) {
        return `${at}: 外接圆直径必须在 0 以上、200 以内`
      }
      if (分割数无效(row.divisions)) return `${at}: 分割数须为 0 或 3~360`
    }
    if (角度无效(row.angle)) return `${at}: 角度必须在 -90~90 之间`
    if (高度无效(row.height) || 非台面高度为零(row.height, row.angle)) {
      return 非台面高度为零(row.height, row.angle)
        ? `${at}: 非台面行高度不能为 0`
        : `${at}: 高度必须在 0~20 之间`
    }
    if (配方无效(row.recipe)) return `${at}: 未选择配方`
  }
  return null
}

export function 校验全部目标(targets: Iterable<TenPlusTarget>): string | null {
  for (const target of targets) {
    const err = 校验目标行(target.name, target.rows)
    if (err) return err
  }
  return null
}
