// =============================================================================
// Laser 模块类型定义
// 先 type（简单别名/字面量），后 interface（复杂对象结构）
// =============================================================================

// ============ type 定义 ============

export type Rs232Parity = 'none' | 'odd' | 'even' | 'mark' | 'space'

export type Rs232StopBits = 1 | 1.5 | 2

export type Rs232DataBits = 5 | 6 | 7 | 8

export type Rs232FlowControl = 'none' | 'xon_xoff' | 'rts_cts' | 'dsr_dtr'

export type Rs232SendMode = 'ascii' | 'hex'

/** 界面可选串口：COM1～COM10（Windows 常见命名） */
export type Rs232ComPortName =
  | 'COM1' | 'COM2' | 'COM3' | 'COM4' | 'COM5'
  | 'COM6' | 'COM7' | 'COM8' | 'COM9' | 'COM10'

// ============ interface 定义 ============

/** 串口配置 */
export interface Rs232PortConfig {
  portName: Rs232ComPortName
  baudRate: number
  dataBits: Rs232DataBits
  parity: Rs232Parity
  stopBits: Rs232StopBits
  flowControl: Rs232FlowControl
  timeoutMs: number
  encoding: 'utf-8' | 'gbk' | 'ascii'
}

/** 串口发送配置 */
export interface Rs232SendConfig {
  mode: Rs232SendMode
  payload: string
  appendCr: boolean
  appendLf: boolean
  autoSend: boolean
  autoSendIntervalMs: number
}

/** 串口接收配置（mode 复用 Rs232SendMode 表示接收展示格式 'ascii' | 'hex'） */
export interface Rs232ReceiveConfig {
  mode: Rs232SendMode
  maxBufferLines: number
  showTimestamp: boolean
  autoScroll: boolean
}

/** 串口快捷指令 */
export interface Rs232QuickCommand {
  id: string
  title: string
  description: string
  mode: Rs232SendMode
  payload: string
}

/** 串口发送请求 */
export interface Rs232SendRequest {
  port: Rs232PortConfig
  send: Rs232SendConfig
}

/** 完整串口会话请求 */
export interface Rs232SerialSessionRequest {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
}

/** 串口发送结果 */
export interface Rs232SendResult {
  success: boolean
  message: string
  timestamp: string
}

/** 串口 API 约定 */
export interface Rs232ApiContract {
  id: string
  method: 'GET' | 'POST'
  endpoint: string
  summary: string
}

/** RS232 工作台完整状态 */
export interface Rs232WorkbenchState {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
  receiveBuffer: string
  quickCommands: Rs232QuickCommand[]
}

/** 激光应用参数 */
export interface LaserApplyPayload {
  laserManufacturer?: string
  laserPower?: number
  laserFrequency?: number
  laserCurrent?: number
}

/** 激光设置参数 */
export interface LaserSettingsPayload {
  manufacturer: string
  port: string
  power: string
  frequency: string
  current: string
}

/** 串口设备信息 */
export interface Rs232PortInfo {
  device: string
  name: string
  description: string
}
