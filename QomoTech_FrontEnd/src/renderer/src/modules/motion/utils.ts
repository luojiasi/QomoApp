export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const MAX_DECIMALS = 4
/** U 的 °/s 含 360，工程速度必须比界面多留几位，否则 5 → 0.0139 → 5.004。 */
export const SPEED_ENG_DECIMALS = 8
export function roundMax(n: number, decimals = MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

/** 与后端 motion_config / R 轴每圈脉冲换算同一口径。 */
export type AxisSpeedRef = {
  axis_name: string
  motor_type?: string
  units: number
  speed: number
  pulses_per_rev: number
  electronic_gear_ratio: number
  gear_ratio: number
  step_angle?: number
  microsteps?: number
}

const SERVO_ONLY_FIELD_KEYS = ['pulses_per_rev', 'electronic_gear_ratio'] as const
const STEPPER_ONLY_FIELD_KEYS = ['step_angle', 'microsteps'] as const

/** 伺服看每圈脉冲/电子齿轮比，步进看步进角/细分；减速比两种都用。 */
export function 轴参数对电机类型是否适用(电机类型: string | undefined, fieldKey: string): boolean {
  if ((SERVO_ONLY_FIELD_KEYS as readonly string[]).includes(fieldKey)) return 电机类型 !== 'stepper'
  if ((STEPPER_ONLY_FIELD_KEYS as readonly string[]).includes(fieldKey)) return 电机类型 === 'stepper'
  return true
}

function 有效每圈脉冲数(轴: AxisSpeedRef): number {
  const 减速比 = Number(轴.gear_ratio)
  if (轴.motor_type === 'stepper') {
    const 步进角 = Number(轴.step_angle)
    const 细分 = Number(轴.microsteps)
    if (步进角 <= 0 || 细分 <= 0 || 减速比 <= 0) return 0
    return (360 / 步进角) * 细分 * 减速比
  }
  return Number(轴.pulses_per_rev) * Number(轴.electronic_gear_ratio) * 减速比
}

export function 运行速度显示单位(轴名: string): string {
  if (轴名 === 'U') return '°/s'
  if (轴名 === 'R') return '圈/s'
  return 'mm/s'
}

/** 控制器 SPEED（工程单位/s）→ 界面：U 为 °/s，R 为 圈/s，其余 mm/s。 */
export function 工程速度转显示速度(轴: AxisSpeedRef): number {
  const 工程速度 = Number(轴.speed)
  if (!Number.isFinite(工程速度)) return 0
  const units = Number(轴.units)
  const 每圈脉冲 = 有效每圈脉冲数(轴)
  if (units <= 0 || 每圈脉冲 <= 0) return 工程速度
  const 圈每秒 = (工程速度 * units) / 每圈脉冲
  if (轴.axis_name === 'U') return 圈每秒 * 360
  if (轴.axis_name === 'R') return 圈每秒
  return 工程速度
}

/** 界面速度 → 控制器 SPEED（工程单位/s）。 */
export function 显示速度转工程速度(轴: AxisSpeedRef, 显示速度: number): number {
  if (!Number.isFinite(显示速度)) return 轴.speed
  const units = Number(轴.units)
  const 每圈脉冲 = 有效每圈脉冲数(轴)
  if (units <= 0 || 每圈脉冲 <= 0) return 显示速度
  if (轴.axis_name === 'U') return (显示速度 / 360) * 每圈脉冲 / units
  if (轴.axis_name === 'R') return 显示速度 * 每圈脉冲 / units
  return 显示速度
}
