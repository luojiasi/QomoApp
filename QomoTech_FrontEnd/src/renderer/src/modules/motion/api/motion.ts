import type { CommonOnlineCommand } from '../index'

const AXIS_STATUS_BIT_DESCRIPTIONS = [
  { value: 2, description: '随动误差超限告警' },
  { value: 4, description: '与远程轴通讯出错' },
  { value: 8, description: '远程驱动器报错' },
  { value: 16, description: '正向硬限位' },
  { value: 32, description: '负向硬限位' },
  { value: 64, description: '找原点中' },
  { value: 128, description: 'HOLD 速度保持信号输入' },
  { value: 256, description: '随动误差超限出错' },
  { value: 512, description: '超过正向软限位' },
  { value: 1024, description: '超过负向软限位' },
  { value: 2048, description: 'CANCEL 执行中' },
  { value: 4096, description: '脉冲频率超过 MAX_SPEED 限制（需降速或调整 MAX_SPEED）' },
  { value: 16384, description: '机械手指令坐标错误' },
  { value: 262144, description: '电源足够' },
  { value: 524288, description: '精确输出缓冲溢出' },
  { value: 1048576, description: '轴速度保护（瞬时速度大于 MAX_SPEED）' },
  { value: 2097152, description: '运动中触发特殊运动指令失败' },
  { value: 4194304, description: '告警信号输入' },
  { value: 8388608, description: '轴进入暂停状态' }
] as const

export const commonOnlineCommandsData: readonly CommonOnlineCommand[] = [
  {
    description: '持续运动',
    command: 'VMOVE(1) AXIS(0)',
    usage: 'VMOVE(DIR) AXIS(轴号);DIR：-1负向运动，1正向运动'
  },
  {
    description: '单轴停止',
    command: 'CANCEL(4) AXIS(0)',
    usage: 'CANCEL(MODE) AXIS(轴号);MODE：0(缺省)取消当前运动；1取消缓冲的运动；2取消当前运动和缓冲运动；3立即中断脉冲发送；4取消当前运动和缓冲运动'
  },
  {
    description: '获取轴状态',
    command: '?AXISSTATUS(0)',
    usage: '?AXISSTATUS(轴号);获取轴状态，返回内容为轴状态字符串'
  },
  {
    description: '设置反向间隙',
    command: 'BACKLASH(1,10,50,100) AXIS(0)',
    usage: '打开反向间隙功能：BACKLASH([使能与否],[距离units单位],[反向间隙速度],[反向间隙加速度]) AXIS(轴号);关闭反向间隙功能：BACKLASH(0)'
  },
  {
    description: '设置输出口',
    command: 'OP(0,7,0)',
    usage: 'OP(IO号,状态);设置输出口状态，状态：OFF关闭，ON打开 ;  OP(0,7,$FF) 打开0~7输出口 OP(0,7,0)关闭0~7输出口 '
  },
] as const

export function resolveOnlineCommandResultText(data: unknown, fallback?: string): string {
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const candidate = record.result ?? record.response ?? record.output ?? record.data
    if (typeof candidate === 'string' && candidate.trim()) return candidate
    if (candidate !== undefined) return JSON.stringify(candidate)
    return JSON.stringify(record)
  }
  return fallback ?? ''
}

export function isAxisStatusCommand(command: string): boolean {
  return command.toUpperCase().includes('AXISSTATUS')
}

export function parseAxisStatusValue(text: string): number | null {
  const normalized = String(text ?? '').trim()
  if (!normalized) return null

  const hexWithHMatches = [...normalized.matchAll(/\b([0-9a-fA-F]+)h\b/g)]
  if (hexWithHMatches.length > 0) {
    const hexValue = hexWithHMatches[hexWithHMatches.length - 1]?.[1]
    if (hexValue) return Number.parseInt(hexValue, 16)
  }

  const hexMatches = [...normalized.matchAll(/0x([0-9a-fA-F]+)/g)]
  if (hexMatches.length > 0) {
    const hexValue = hexMatches[hexMatches.length - 1]?.[1]
    if (hexValue) return Number.parseInt(hexValue, 16)
  }

  const decMatches = [...normalized.matchAll(/\b\d+\b/g)]
  if (decMatches.length > 0) {
    const decValue = decMatches[decMatches.length - 1]?.[0]
    if (decValue) return Number.parseInt(decValue, 10)
  }

  return null
}

export function formatAxisStatusAnalysis(rawText: string): string {
  const statusValue = parseAxisStatusValue(rawText)
  if (statusValue === null || !Number.isFinite(statusValue)) {
    return `原始返回:\n${rawText}\n\nAXISSTATUS 解析:\n未识别到有效数值，无法进行状态位解析。`
  }

  const matched = AXIS_STATUS_BIT_DESCRIPTIONS.filter((item) => (statusValue & item.value) === item.value).map((item) => `- [${item.value}] ${item.description}`)

  return [
    '原始返回:',
    rawText,
    'AXISSTATUS 解析:',
    `- 十进制: ${statusValue}`,
    `- 十六进制: 0x${statusValue.toString(16).toUpperCase()}`,
    matched.length > 0 ? matched.join('\n') : '- 未命中状态位（当前状态值可能为未有异常）'
  ].join('\n')
}

export function formatOnlineCommandResultByCommand(command: string, resultText: string): string {
  if (!isAxisStatusCommand(command)) return resultText
  return formatAxisStatusAnalysis(resultText)
}
