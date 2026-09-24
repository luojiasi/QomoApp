/** 十轴页键盘点动默认关闭，避免填表时误触轴运动 */
export const 默认键盘启用 = false
/** 十轴页相机窗口默认显示，与主页 CameraPic 一致 */
export const 默认相机可见 = true
/** 相机窗口十字线调节条默认隐藏，点按钮再打开 */
export const 默认十字线栏可见 = false
/** 运行时相机放大替代中间任务参数表，默认关闭 */
export const 默认运行相机放大 = false
export const 页面界面存储键 = 'qomo.tenPlus.pageUi'
/** 相机窗口与屏幕边缘的间距 */
export const 相机窗口边距 = 16
/** 找不到底栏时预留高度，避免挡住「开始任务」 */
export const 相机窗口底栏回退 = 56

export const UR十字线存储键 = 'qomo.tenPlus.urCrosshair'
export const UR十字线宽度最小 = 1
export const UR十字线宽度最大 = 10
export const UR十字线默认值 = {hColor: '#f87171',vColor: '#60a5fa',hWidth: 2,vWidth: 2} as const

export const 工位数 = 10
export const 文件版本 = '2.3.0'
export const 文件扩展名 = '.jjs'
export const 文件格式 = 'QOMO5P-FreeParamTargets' as const

/** 网格显示顺序：左列 6–10，右列 1–5（行优先） */
export const 网格顺序: number[] = [6, 1, 7, 2, 8, 3, 9, 4, 10, 5]

/** 工位夹具输出口：1/6→3，2/7→4，3/8→5，4/9→6，5/10→7 */
export const 工位输出口: readonly number[] = [3, 4, 5, 6, 7]

export function 工位转输出口(工位序号: number): number | null {
  if (!Number.isInteger(工位序号) || 工位序号 < 1 || 工位序号 > 工位数) {return null}
  return ((工位序号 - 1) % 5) + 3
}


export const 默认弦长倍率 = 1.2
export const 弦长倍率步进 = 0.1
export const 默认直径百分比 = 100
export const 默认高度百分比 = 100
export const 默认起始切割百分比 = 0
export const 默认结束切割百分比 = 100
export const 默认R圈数 = 2
export const 默认相机清晰误差 = 0
export const 默认钻石百分比 = 0
export const 默认线长 = 4
export const 默认线宽 = 4

/**
 * 非等分直线（切角矩形）切角比例默认值 (%)。
 * 沿用行业 corner ratio 定义：切角在宽度方向的投影占宽的百分比。
 */
export const 默认切角比例 = 14

/**
 * 切角比例推荐值：两种切工的外轮廓公式完全相同，只是行业惯用比例不同。
 * 来源：AGS 祖母绿切工几何规范、US10448713 专利、Octonus/Helium 雷迪恩实测报告。
 */
export const 切角比例推荐: ReadonlyArray<{shape: string; alias: string; value: number; range: string}> = [
  { shape: '祖母绿', alias: 'Emerald', value: 14, range: '13.5%–14.5%' },
  { shape: '雷迪恩', alias: 'Radiant', value: 15, range: '13.6%–16.7%' }
]

/** 任务行全部合法 pathType（含不单独占按钮的子类型）。读档校验用这个。 */
export const 路径类型选项: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'equalSegments', label: '等分线段' },
  { value: 'curve', label: '曲线' },
  { value: 'unEqualSegments', label: '非等分直线' }
]

/** 类型列按钮。非等分直线并进等分线段，双击选子类型。 */
export const 路径类型按钮: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'equalSegments', label: '等分线段' },
  { value: 'curve', label: '曲线' }
]

export const 默认路径类型 = 路径类型选项[0]?.value ?? 'equalSegments'

export const 等分线段类型 = 'equalSegments'
export const 非等分直线类型 = 'unEqualSegments'
export const 曲线路径类型 = 'curve'

/** 等分线段按钮下的子类型。下发仍用原来的 pathType，不新增字段。 */
export const 线段子类型选项: ReadonlyArray<{ value: string; label: string }> = [
  { value: 等分线段类型, label: '等分线段' },
  { value: 非等分直线类型, label: '非等分直线' }
]

/** 曲线子类型。主选项仍是「曲线」，子类型用于悬停提示与后端按类型取参。 */
export const 曲线子类型圆 = 'circle'
export const 曲线子类型超椭圆 = 'superellipse'
export const 曲线子类型选项: ReadonlyArray<{ value: string; label: string }> = [
  { value: 曲线子类型圆, label: '中心圆曲线' },
  { value: 曲线子类型超椭圆, label: '超椭圆' }
]
export const 默认曲线子类型 = 曲线子类型圆

/** 曲线默认：朝 +X 的 90° 鼓边（垫形一圈可连续四行，后三行勾同层） */
export const 默认弧起点 = -45
export const 默认弧终点 = 45
export const 默认弧偏移 = 0
/** 0 = 普通圆弧；垫型快捷形状写入 >0 的超椭圆指数 */
export const 默认超椭圆指数 = 0

export function 是等分线段(路径类型: string): boolean {return 路径类型 === 等分线段类型}

export function 是非等分直线(路径类型: string): boolean {return 路径类型 === 非等分直线类型}

/** 类型列「等分线段」按钮覆盖等分 / 非等分两种 pathType */
export function 是等分组(路径类型: string): boolean {return 是等分线段(路径类型) || 是非等分直线(路径类型)}

export function 是曲线(路径类型: string): boolean {return 路径类型 === 曲线路径类型}

export function 解析曲线子类型(原始: unknown, 超椭圆指数 = 0): string {
  const 取值 = typeof 原始 === 'string' ? 原始 : ''
  if (曲线子类型选项.some((项) => 项.value === 取值)) return 取值
  if (Number(超椭圆指数) > 0) return 曲线子类型超椭圆
  return 默认曲线子类型
}

export function 曲线子类型标签(曲线子类型: string, 超椭圆指数 = 0): string {
  const 子类型 = 解析曲线子类型(曲线子类型, 超椭圆指数)
  return 曲线子类型选项.find((项) => 项.value === 子类型)?.label ?? '曲线'
}

export function 线段子类型标签(路径类型: string): string {return 线段子类型选项.find((项) => 项.value === 路径类型)?.label ?? '等分线段'}

export function 路径类型标题(选项值: string,选项标签: string,曲线子类型: string,超椭圆指数 = 0,行路径类型 = ''): string {
  if (选项值 === 曲线路径类型) {return 曲线子类型标签(曲线子类型, 超椭圆指数)}
  if (选项值 === 等分线段类型) {return 线段子类型标签(是等分组(行路径类型) ? 行路径类型 : 等分线段类型)}
  return 选项标签
}

export function 是超椭圆曲线(路径类型: string,曲线子类型: string,超椭圆指数 = 0): boolean {return 是曲线(路径类型) && 解析曲线子类型(曲线子类型, 超椭圆指数) === 曲线子类型超椭圆}

export function 解析路径类型(原始: unknown): string {
  const 取值 = typeof 原始 === 'string' ? 原始 : ''
  if (路径类型选项.some((项) => 项.value === 取值)) return 取值
  return 默认路径类型
}

/** 角度为 0（台面行）时锁定为默认值、不可编辑的字段 */
export const 台面锁定默认值 = {height: 0,heightPercent: 默认高度百分比,divisions: 0,k: 0,b: 0,x: 0} as const

export function 是台面角(值: number): boolean {return Number(值) === 0}
