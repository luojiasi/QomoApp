export type Rs232Parity = 'none' | 'odd' | 'even' | 'mark' | 'space'

export type Rs232StopBits = 1 | 1.5 | 2

export type Rs232DataBits = 5 | 6 | 7 | 8

export type Rs232FlowControl = 'none' | 'xon_xoff' | 'rts_cts' | 'dsr_dtr'

export type Rs232SendMode = 'ascii' | 'hex'

/** 界面可选串口：COM1～COM10（Windows 常见命名） */
export type Rs232ComPortName =
  | 'COM1'
  | 'COM2'
  | 'COM3'
  | 'COM4'
  | 'COM5'
  | 'COM6'
  | 'COM7'
  | 'COM8'
  | 'COM9'
  | 'COM10'

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

/** 接收区展示与缓冲策略（仅配置，实际读串口待接入） */
export interface Rs232ReceiveConfig {
  /** 接收内容展示格式 */
  mode: Rs232SendMode
  /** 接收日志最大行数（超出时从顶部丢弃，由业务层实现） */
  maxBufferLines: number
  /** 是否在每行前显示时间戳 */
  showTimestamp: boolean
  /** 新数据到达时是否自动滚动到底部 */
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

/** 打开串口并启动收发时可一并提交的完整会话参数 */
export interface Rs232SerialSessionRequest {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
}

export interface Rs232SendResult {
  success: boolean
  message: string
  timestamp: string
}

export interface Rs232ApiContract {
  id: string
  method: 'GET' | 'POST'
  endpoint: string
  summary: string
}

export interface Rs232WorkbenchState {
  port: Rs232PortConfig
  send: Rs232SendConfig
  receive: Rs232ReceiveConfig
  /** 接收日志文本（由串口逻辑写入；界面可清空） */
  receiveBuffer: string
  quickCommands: Rs232QuickCommand[]
}
