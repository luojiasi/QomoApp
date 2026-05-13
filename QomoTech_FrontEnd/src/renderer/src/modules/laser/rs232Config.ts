import type { ParameterSection } from '@/shared/types'
import type {
  Rs232ApiContract,
  Rs232ComPortName,
  Rs232DataBits,
  Rs232FlowControl,
  Rs232Parity,
  Rs232SendMode,
  Rs232StopBits,
  Rs232WorkbenchState
} from './rs232Types'

/** 下拉可选串口：COM1～COM10 */
export const RS232_COM_PORT_OPTIONS: readonly Rs232ComPortName[] = [
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'COM10'
] as const

export const RS232_BAUD_RATE_OPTIONS = [
  1200,
  2400,
  4800,
  9600,
  19200,
  38400,
  57600,
  115200,
  230400
] as const

export const RS232_DATA_BITS_OPTIONS: readonly Rs232DataBits[] = [5, 6, 7, 8]

export const RS232_PARITY_OPTIONS: readonly Rs232Parity[] = ['none', 'odd', 'even', 'mark', 'space']

export const RS232_STOP_BITS_OPTIONS: readonly Rs232StopBits[] = [1, 1.5, 2]

export const RS232_FLOW_CONTROL_OPTIONS: readonly Rs232FlowControl[] = [
  'none',
  'xon_xoff',
  'rts_cts',
  'dsr_dtr'
]

export const RS232_SEND_MODE_OPTIONS: readonly Rs232SendMode[] = ['ascii', 'hex']

export const rs232ApiContracts: Rs232ApiContract[] = [
  {
    id: 'rs232-list-ports',
    method: 'GET',
    endpoint: '/api/rs232/ports',
    summary: '获取本机可用串口列表（用于端口下拉选项）'
  },
  {
    id: 'rs232-open-port',
    method: 'POST',
    endpoint: '/api/rs232/open',
    summary: '按串口配置打开连接并启动接收缓冲（port / receive）'
  },
  {
    id: 'rs232-send',
    method: 'POST',
    endpoint: '/api/rs232/send',
    summary: '发送一帧数据（ASCII/HEX、CR/LF；需先 open）'
  },
  {
    id: 'rs232-buffer',
    method: 'GET',
    endpoint: '/api/rs232/buffer',
    summary: '轮询接收缓冲区文本（?clear=true 可清空后端缓冲）'
  },
  {
    id: 'rs232-close-port',
    method: 'POST',
    endpoint: '/api/rs232/close',
    summary: '关闭当前串口连接并释放资源'
  }
]

export const defaultRs232WorkbenchState: Rs232WorkbenchState = {
  port: {
    portName: 'COM4',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    timeoutMs: 200,
    encoding: 'utf-8'
  },
  send: {
    mode: 'ascii',
    payload: '',
    appendCr: true,
    appendLf: true,
    autoSend: false,
    autoSendIntervalMs: 1000
  },
  receive: {
    mode: 'ascii',
    maxBufferLines: 500,
    showTimestamp: true,
    autoScroll: true
  },
  receiveBuffer: '',
  quickCommands: [
    {
      id: 'send-current',
      title: '发送电流',
      description: '发送电流指令',
      mode: 'ascii',
      payload: 'LD1CS 100'
    },
    {
      id: 'send-power',
      title: '发送功率',
      description: '发送功率指令',
      mode: 'ascii',
      payload: 'POW 100'
    },
    {
      id: 'send-frequency',
      title: '发送频率',
      description: '发送频率指令',
      mode: 'ascii',
      payload: 'REPF 100'
    }
  ]
}

export const createRs232Sections = (state: Rs232WorkbenchState): ParameterSection[] => [
  {
    id: 'rs232-port',
    title: '串口参数',
    description: '用于连接 RS232 设备的基础参数配置。',
    fields: [
      { key: 'portName', label: '串口号', value: state.port.portName },
      { key: 'baudRate', label: '波特率', value: state.port.baudRate, unit: 'bps' },
      { key: 'dataBits', label: '数据位', value: state.port.dataBits },
      { key: 'parity', label: '校验位', value: state.port.parity },
      { key: 'stopBits', label: '停止位', value: state.port.stopBits },
      { key: 'flowControl', label: '流控', value: state.port.flowControl },
      { key: 'timeoutMs', label: '超时时间', value: state.port.timeoutMs, unit: 'ms' },
      { key: 'encoding', label: '编码', value: state.port.encoding }
    ]
  },
  {
    id: 'rs232-send',
    title: '发送参数',
    description: '用于定义数据帧格式和自动发送行为（仅界面层配置）。',
    fields: [
      { key: 'mode', label: '发送模式', value: state.send.mode },
      { key: 'payload', label: '发送内容', value: state.send.payload || '(空)' },
      { key: 'appendCr', label: '附加 CR', value: state.send.appendCr },
      { key: 'appendLf', label: '附加 LF', value: state.send.appendLf },
      { key: 'autoSend', label: '自动发送', value: state.send.autoSend },
      {
        key: 'autoSendIntervalMs',
        label: '自动发送间隔',
        value: state.send.autoSendIntervalMs,
        unit: 'ms'
      }
    ]
  },
  {
    id: 'rs232-receive',
    title: '接收参数',
    description: '接收缓冲区展示格式与行数限制（仅界面层配置）。',
    fields: [
      { key: 'receiveMode', label: '接收展示模式', value: state.receive.mode },
      {
        key: 'maxBufferLines',
        label: '最大缓冲行数',
        value: state.receive.maxBufferLines,
        unit: '行'
      },
      { key: 'showTimestamp', label: '显示时间戳', value: state.receive.showTimestamp },
      { key: 'autoScroll', label: '自动滚动到底部', value: state.receive.autoScroll },
      {
        key: 'receiveBytes',
        label: '当前缓冲字符数',
        value: state.receiveBuffer.length,
        unit: '字符'
      }
    ]
  }
]
