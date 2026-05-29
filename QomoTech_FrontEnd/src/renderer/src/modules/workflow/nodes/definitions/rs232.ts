// ─────────────────────────────────────────────────────────────
// nodes/definitions/rs232.ts — 串口通讯类节点蓝图
//
// rs232 类节点通过 routing + bodyGroup 声明嵌套 body 结构，
// 通用 httpExecutor 自动将扁平 params 重组为后端所需的嵌套格式。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 串口连接节点
 * 打开指定串口并配置端口参数和接收方式。
 *
 * 对应后端：POST /api/rs232/open
 * bodyGroup → { port: {...}, receive: {...} }
 */
const rs232Connect: NodeTypeDef = {
  type: 'rs232.connect',
  category: 'rs232',
  displayName: '串口连接',
  icon: '⚡',
  color: '#a16207',
  description: '打开串口连接并配置波特率、数据位、校验位等参数',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'portName',
      displayName: '端口名',
      type: 'string',
      default: 'COM3',
      required: true,
      description: '串口端口名称，如 COM3、/dev/ttyUSB0',
      placeholder: 'COM3'
    },
    {
      name: 'baudRate',
      displayName: '波特率',
      type: 'select',
      default: 9600,
      required: true,
      description: '串口通讯波特率',
      options: [
        { label: '9600', value: 9600 },
        { label: '19200', value: 19200 },
        { label: '38400', value: 38400 },
        { label: '57600', value: 57600 },
        { label: '115200', value: 115200 }
      ]
    },
    {
      name: 'dataBits',
      displayName: '数据位',
      type: 'select',
      default: 8,
      required: true,
      options: [
        { label: '5', value: 5 },
        { label: '6', value: 6 },
        { label: '7', value: 7 },
        { label: '8', value: 8 }
      ]
    },
    {
      name: 'parity',
      displayName: '校验位',
      type: 'select',
      default: 'none',
      required: true,
      options: [
        { label: '无', value: 'none' },
        { label: '奇校验', value: 'odd' },
        { label: '偶校验', value: 'even' },
        { label: '标记', value: 'mark' },
        { label: '空格', value: 'space' }
      ]
    },
    {
      name: 'stopBits',
      displayName: '停止位',
      type: 'select',
      default: 1,
      required: true,
      options: [
        { label: '1', value: 1 },
        { label: '1.5', value: 1.5 },
        { label: '2', value: 2 }
      ]
    },
    {
      name: 'receiveMode',
      displayName: '接收模式',
      type: 'select',
      default: 'ascii',
      required: false,
      options: [
        { label: 'ASCII', value: 'ascii' },
        { label: 'HEX', value: 'hex' }
      ],
      description: '接收数据的解析模式'
    }
  ],
  defaults: {
    portName: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    timeoutMs: 1000,
    encoding: 'utf-8',
    receiveMode: 'ascii',
    maxBufferLines: 500,
    showTimestamp: false,
    autoScroll: true
  },
  routing: {
    method: 'POST',
    endpoint: '/api/rs232/open',
    paramLocation: 'body',
    bodyGroup: {
      port: ['portName', 'baudRate', 'dataBits', 'parity', 'stopBits', 'flowControl', 'timeoutMs', 'encoding'],
      receive: [['receiveMode', 'mode'], 'maxBufferLines', 'showTimestamp', 'autoScroll']
    }
  }
}
/**
 * 串口关闭节点
 * 关闭当前打开的串口连接。
 *
 * 对应后端：POST /api/rs232/close
 */
const rs232Disconnect: NodeTypeDef = {
  type: 'rs232.disconnect',
  category: 'rs232',
  displayName: '串口关闭',
  icon: '⚡',
  color: '#a16207',
  description: '关闭当前串口连接',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'POST',
    endpoint: '/api/rs232/close',
    paramLocation: 'body'
  }
}

/**
 * 串口检测节点
 * 枚举系统中可用的串口设备列表。
 *
 * 对应后端：GET /api/rs232/ports
 */
const rs232Detect: NodeTypeDef = {
  type: 'rs232.detect',
  category: 'rs232',
  displayName: '串口检测',
  icon: '⚡',
  color: '#a16207',
  description: '检测并返回系统中可用的串口设备列表',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '输出' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'GET',
    endpoint: '/api/rs232/ports',
    paramLocation: 'query'
  }
}



/**
 * 串口数据发送节点
 * 通过上游数据构建发送内容，调用已打开的串口发送数据。
 *
 * 对应后端：POST /api/rs232/send
 * bodyGroup → { port: {...}, send: {...} }
 *
 * payload 支持 $ 表达式引用上游数据，如 $main.data.text。
 * 端口参数（baudRate 等）为隐藏默认值，仅 portName 暴露给用户。
 */
const rs232Send: NodeTypeDef = {
  type: 'rs232.send',
  category: 'rs232',
  displayName: '串口数据发送',
  icon: '⚡',
  color: '#a16207',
  description: '通过上游数据构建发送内容，通过已打开的串口发送数据',
  version: 1,
  inputs: [
    { name: 'port', displayName: '端口', triggers: false },
    { name: 'main', displayName: '执行' },
    { name: 'data', displayName: '数据', triggers: false }
  ],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'portName',
      displayName: '端口名',
      type: 'string',
      default: 'COM3',
      required: true,
      description: '目标串口端口名，需与已打开的端口一致。连接 port 输入后可设为 $port.data.portName',
      placeholder: 'COM3'
    },
    {
      name: 'payload',
      displayName: '发送数据',
      type: 'expression',
      default: '$data',
      required: true,
      description: '发送的字符串数据，默认从 data 端口获取，也可用 $data.xxx 引用具体字段',
      placeholder: '$data'
    },
    {
      name: 'mode',
      displayName: '发送模式',
      type: 'select',
      default: 'ascii',
      required: false,
      description: '数据发送编码模式',
      options: [
        { label: 'ASCII', value: 'ascii' },
        { label: 'HEX', value: 'hex' }
      ]
    },
    {
      name: 'appendCr',
      displayName: '附加 CR',
      type: 'boolean',
      default: true,
      description: '在发送数据末尾附加回车符 \\r'
    },
    {
      name: 'appendLf',
      displayName: '附加 LF',
      type: 'boolean',
      default: true,
      description: '在发送数据末尾附加换行符 \\n'
    }
  ],
  defaults: {
    portName: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    timeoutMs: 1000,
    encoding: 'utf-8',
    payload: '$data',
    mode: 'ascii',
    appendCr: true,
    appendLf: true,
    autoSend: false,
    autoSendIntervalMs: 1000
  },
  routing: {
    method: 'POST',
    endpoint: '/api/rs232/send',
    paramLocation: 'body',
    bodyGroup: {
      port: ['portName', 'baudRate', 'dataBits', 'parity', 'stopBits', 'flowControl', 'timeoutMs', 'encoding'],
      send: ['mode', 'payload', 'appendCr', 'appendLf', 'autoSend', 'autoSendIntervalMs']
    }
  }
}

export const rs232Defs: NodeTypeDef[] = [rs232Connect, rs232Disconnect, rs232Detect, rs232Send]
