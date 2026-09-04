export const TEN_PLUS_UR_CROSSHAIR_STORAGE_KEY = 'qomo.tenPlus.urCrosshair'
export const TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN = 1
export const TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX = 10
export const TEN_PLUS_UR_CROSSHAIR_DEFAULTS = {
  hColor: '#f87171',
  vColor: '#60a5fa',
  hWidth: 2,
  vWidth: 2
} as const

export const TEN_PLUS_SLOT_COUNT = 10
export const TEN_PLUS_FILE_VERSION = '2.3.0'
export const TEN_PLUS_FILE_EXT = '.jjs'
export const TEN_PLUS_FILE_FORMAT = 'QOMO5P-FreeParamTargets' as const
export const LEGACY_TASK_TABLE_FORMAT = 'QOMO5P-TaskTable' as const

/** 网格显示顺序：左列 6–10，右列 1–5（行优先） */
export const TEN_PLUS_GRID_ORDER: number[] = [6, 1, 7, 2, 8, 3, 9, 4, 10, 5]

/** 工位夹具输出口：1/6→3，2/7→4，3/8→5，4/9→6，5/10→7 */
export const TEN_PLUS_STATION_OUTPUT_PORTS: readonly number[] = [3, 4, 5, 6, 7]

export function slotIndexToOutputPort(slotIndex: number): number | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > TEN_PLUS_SLOT_COUNT) {
    return null
  }
  return ((slotIndex - 1) % 5) + 3
}

/** 弦长倍率默认值；台面行仍可编辑 */
export const TEN_PLUS_DEFAULT_CHORD_RATIO = 1.2

/** 直径百分比默认值（100 表示按原直径） */
export const TEN_PLUS_DEFAULT_DIAMETER_PERCENT = 100

/** 高度百分比默认值（100 表示按原高度） */
export const TEN_PLUS_DEFAULT_HEIGHT_PERCENT = 100

/** 钻石比例百分比默认值 */
export const TEN_PLUS_DEFAULT_DIAMOND_PERCENT = 0

/** 非等分直线的长、宽默认值 (mm) */
export const TEN_PLUS_DEFAULT_LINE_LENGTH = 4
export const TEN_PLUS_DEFAULT_LINE_WIDTH = 4

/**
 * 非等分直线（切角矩形）切角比例默认值 (%)。
 * 沿用行业 corner ratio 定义：切角在宽度方向的投影占宽的百分比。
 */
export const TEN_PLUS_DEFAULT_CORNER_RATIO = 14

/**
 * 切角比例推荐值：两种切工的外轮廓公式完全相同，只是行业惯用比例不同。
 * 来源：AGS 祖母绿切工几何规范、US10448713 专利、Octonus/Helium 雷迪恩实测报告。
 */
export const TEN_PLUS_CORNER_RATIO_RECOMMENDATIONS: ReadonlyArray<{
  shape: string
  alias: string
  value: number
  range: string
}> = [
  { shape: '祖母绿', alias: 'Emerald', value: 14, range: '13.5%–14.5%' },
  { shape: '雷迪恩', alias: 'Radiant', value: 15, range: '13.6%–16.7%' }
]

/** 任务行全部合法 pathType（含不单独占按钮的子类型）。读档校验用这个。 */
export const TEN_PLUS_PATH_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'equalSegments', label: '等分线段' },
  { value: 'curve', label: '曲线' },
  { value: 'unEqualSegments', label: '非等分直线' },
  { value: 'singleLine', label: '单直线' }
]

/** 类型列按钮。非等分直线并进等分线段，双击选子类型。 */
export const TEN_PLUS_PATH_TYPE_BUTTONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'equalSegments', label: '等分线段' },
  { value: 'curve', label: '曲线' },
  { value: 'singleLine', label: '单直线' }
]

export const TEN_PLUS_DEFAULT_PATH_TYPE = TEN_PLUS_PATH_TYPE_OPTIONS[0]?.value ?? 'equalSegments'

export const TEN_PLUS_EQUAL_LINE_PATH_TYPE = 'equalSegments'
export const TEN_PLUS_UNEQUAL_LINE_PATH_TYPE = 'unEqualSegments'
export const TEN_PLUS_CURVE_PATH_TYPE = 'curve'
export const TEN_PLUS_SINGLE_LINE_PATH_TYPE = 'singleLine'

/** 等分线段按钮下的子类型。下发仍用原来的 pathType，不新增字段。 */
export const TEN_PLUS_LINE_KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: TEN_PLUS_EQUAL_LINE_PATH_TYPE, label: '等分线段' },
  { value: TEN_PLUS_UNEQUAL_LINE_PATH_TYPE, label: '非等分直线' }
]

/** 单直线默认：+X 上一根竖线，相对该工位 R 轴旋转中心 (mm) */
export const TEN_PLUS_DEFAULT_LINE_START_X = 1
export const TEN_PLUS_DEFAULT_LINE_START_Y = -1
export const TEN_PLUS_DEFAULT_LINE_END_X = 1
export const TEN_PLUS_DEFAULT_LINE_END_Y = 1

export const TEN_PLUS_LINE_PARAM_MODE_ENDPOINTS = 'endpoints'
export const TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH = 'midLength'
export const TEN_PLUS_LINE_PARAM_MODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: TEN_PLUS_LINE_PARAM_MODE_ENDPOINTS, label: '起终点' },
  { value: TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH, label: '中点长' }
]
export const TEN_PLUS_DEFAULT_LINE_PARAM_MODE = TEN_PLUS_LINE_PARAM_MODE_ENDPOINTS
export const TEN_PLUS_DEFAULT_LINE_MID_X = 1
export const TEN_PLUS_DEFAULT_LINE_MID_Y = 0
/** 与默认起终点 (1,-1)→(1,1) 的长度一致 */
export const TEN_PLUS_DEFAULT_SINGLE_LINE_LENGTH = 2

export function resolveTenPlusLineParamMode(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : ''
  if (TEN_PLUS_LINE_PARAM_MODE_OPTIONS.some((item) => item.value === value)) return value
  return TEN_PLUS_DEFAULT_LINE_PARAM_MODE
}

export function isLineParamMidLength(mode: string): boolean {
  return resolveTenPlusLineParamMode(mode) === TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH
}

/** 曲线子类型。主选项仍是「曲线」，子类型用于悬停提示与后端按类型取参。 */
export const TEN_PLUS_CURVE_KIND_CIRCLE = 'circle'
export const TEN_PLUS_CURVE_KIND_SUPERELLIPSE = 'superellipse'
export const TEN_PLUS_CURVE_KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: TEN_PLUS_CURVE_KIND_CIRCLE, label: '中心圆曲线' },
  { value: TEN_PLUS_CURVE_KIND_SUPERELLIPSE, label: '超椭圆' }
]
export const TEN_PLUS_DEFAULT_CURVE_KIND = TEN_PLUS_CURVE_KIND_CIRCLE

/** 曲线默认：朝 +X 的 90° 鼓边（垫形一圈可连续四行，后三行勾同层） */
export const TEN_PLUS_DEFAULT_ARC_START = -45
export const TEN_PLUS_DEFAULT_ARC_END = 45
export const TEN_PLUS_DEFAULT_ARC_OFFSET = 0
/** 0 = 普通圆弧；垫型快捷形状写入 >0 的超椭圆指数 */
export const TEN_PLUS_DEFAULT_SUPERELLIPSE_N = 0

export function isEqualLinePath(pathType: string): boolean {
  return pathType === TEN_PLUS_EQUAL_LINE_PATH_TYPE
}

export function isUnequalLinePath(pathType: string): boolean {
  return pathType === TEN_PLUS_UNEQUAL_LINE_PATH_TYPE
}

/** 类型列「等分线段」按钮覆盖等分 / 非等分两种 pathType */
export function isEqualLineGroup(pathType: string): boolean {
  return isEqualLinePath(pathType) || isUnequalLinePath(pathType)
}

export function isCurvePath(pathType: string): boolean {
  return pathType === TEN_PLUS_CURVE_PATH_TYPE
}

export function isSingleLinePath(pathType: string): boolean {
  return pathType === TEN_PLUS_SINGLE_LINE_PATH_TYPE
}

/** 曲线 / 单直线：段间靠法线差转 R，同层勾选有效 */
export function isRStepPath(pathType: string): boolean {
  return isCurvePath(pathType) || isSingleLinePath(pathType)
}

export function resolveTenPlusCurveKind(raw: unknown, superellipseN = 0): string {
  const value = typeof raw === 'string' ? raw : ''
  if (TEN_PLUS_CURVE_KIND_OPTIONS.some((item) => item.value === value)) return value
  if (Number(superellipseN) > 0) return TEN_PLUS_CURVE_KIND_SUPERELLIPSE
  return TEN_PLUS_DEFAULT_CURVE_KIND
}

export function tenPlusCurveKindLabel(curveKind: string, superellipseN = 0): string {
  const kind = resolveTenPlusCurveKind(curveKind, superellipseN)
  return TEN_PLUS_CURVE_KIND_OPTIONS.find((item) => item.value === kind)?.label ?? '曲线'
}

export function tenPlusLineKindLabel(pathType: string): string {
  return (
    TEN_PLUS_LINE_KIND_OPTIONS.find((item) => item.value === pathType)?.label ?? '等分线段'
  )
}

export function tenPlusPathTypeTitle(
  itemValue: string,
  itemLabel: string,
  curveKind: string,
  superellipseN = 0,
  rowPathType = ''
): string {
  if (itemValue === TEN_PLUS_CURVE_PATH_TYPE) {
    return tenPlusCurveKindLabel(curveKind, superellipseN)
  }
  if (itemValue === TEN_PLUS_EQUAL_LINE_PATH_TYPE) {
    return tenPlusLineKindLabel(isEqualLineGroup(rowPathType) ? rowPathType : TEN_PLUS_EQUAL_LINE_PATH_TYPE)
  }
  return itemLabel
}

export function isSuperellipseCurve(
  pathType: string,
  curveKind: string,
  superellipseN = 0
): boolean {
  return (
    isCurvePath(pathType) &&
    resolveTenPlusCurveKind(curveKind, superellipseN) === TEN_PLUS_CURVE_KIND_SUPERELLIPSE
  )
}

export function resolveTenPlusPathType(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : ''
  if (TEN_PLUS_PATH_TYPE_OPTIONS.some((item) => item.value === value)) return value
  return TEN_PLUS_DEFAULT_PATH_TYPE
}

/** 角度为 0（台面行）时锁定为默认值、不可编辑的字段 */
export const TEN_PLUS_TABLE_ANGLE_LOCKED_DEFAULTS = {
  height: 0,
  heightPercent: TEN_PLUS_DEFAULT_HEIGHT_PERCENT,
  divisions: 0,
  compX: 0,
  compY: 90,
  compZ: 0,
  k: 0,
  b: 0,
  x: 0
} as const
