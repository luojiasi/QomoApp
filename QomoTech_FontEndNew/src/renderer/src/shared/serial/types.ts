// =============================================================================
// Serial 模块类型定义
// 从 laser 模块移植，适配本项目命名空间
// =============================================================================

// ============ type 定义 ============

export type Rs232Parity = 'none' | 'odd' | 'even' | 'mark' | 'space'

export type Rs232StopBits = 1 | 1.5 | 2

export type Rs232DataBits = 5 | 6 | 7 | 8

export type Rs232FlowControl = 'none' | 'xon_xoff' | 'rts_cts' | 'dsr_dtr'

export type Rs232SendMode = 'ascii' | 'hex'

export type Rs232ComPortName =
  | 'COM1' | 'COM2' | 'COM3' | 'COM4' | 'COM5'
  | 'COM6' | 'COM7' | 'COM8' | 'COM9' | 'COM10'

// ============ interface 定义 ============

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

export interface Rs232SendConfig {
  mode: Rs232SendMode
  payload: string
  appendCr: boolean
  appendLf: boolean
  autoSend: boolean
  autoSendIntervalMs: number
}

export interface Rs232ReceiveConfig {
  mode: Rs232SendMode
  maxBufferLines: number
  showTimestamp: boolean
  autoScroll: boolean
}

export interface Rs232QuickCommand {
  id: string
  title: string
  description: string
  mode: Rs232SendMode
  payload: string
}

export interface Rs232SendRequest {
  port: Rs232PortConfig
  send: Rs232SendConfig
}

export interface Rs232SerialSessionRequest {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
}

export interface Rs232PortInfo {
  device: string
  name: string
  description: string
}

export interface Rs232WorkbenchState {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
  receiveBuffer: string
  quickCommands: Rs232QuickCommand[]
}
