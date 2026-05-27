// ─────────────────────────────────────────────────────────────
// types/nodeDefinition.ts — 节点蓝图类型系统
//
// 这里只定义"节点是什么"的静态结构，不含任何运行时状态。
//
// 与 workflow.ts 的区别：
//   workflow.ts       = 用户创建的数据（存入 JSON 文件）
//   nodeDefinition.ts = 节点种类的描述（写在代码里，不持久化）
//
// 数据流向：
//   nodeDefinition.ts (NodeTypeDef)
//     └─ nodes/definitions/*.ts  ← 按分类写具体节点蓝图
//     └─ nodes/definitions/index.ts (NODE_REGISTRY) ← 汇总注册表
//     └─ nodes/executor/nodeExecutor.ts ← 执行时读取 routing/executeAs
// ─────────────────────────────────────────────────────────────

// ─── 节点参数字段类型 ─────────────────────────────────────────

/**
 * 节点参数的值类型，决定配置面板渲染哪种控件：
 * - string / number / boolean → 文本框 / 数字框 / 开关
 * - select     → 下拉单选（需配合 options）
 * - json       → 多行 JSON 编辑器
 * - expression → 支持 $var.xxx 表达式的文本框
 */
export type NodeParamType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'date'
  | 'time'
  | 'json'
  | 'expression'
  | 'conditionList'

/** select 类型的下拉选项 */
export interface NodeParamOption {
  label: string
  value: string | number | boolean
}

/**
 * 节点参数定义，每条对应配置面板里的一个表单字段。
 * key（name）与 WorkflowNode.params 的 key 对应。
 */
export interface NodeParam {
  name: string
  displayName: string
  type: NodeParamType
  default: unknown
  required?: boolean
  description?: string
  placeholder?: string
  /** type='select' 时的选项列表 */
  options?: NodeParamOption[]
  /**
   * 动态显隐条件：当 params[field] === value 时本字段才显示。
   * @example showWhen: { field: 'mode', value: 'abs' }
   */
  showWhen?: { field: string; value: unknown }
}

// ─── 节点端口 ─────────────────────────────────────────────────

/**
 * 节点端口（画布上的 Handle）。
 *
 * 端口命名约定：
 *   inputs  → 通常只有 'main'
 *   outputs → 至少有 'main'（完成）；需要错误分支加 'error'（失败）
 *             condition 节点输出 'true' / 'false'
 */
export interface NodePort {
  /** Handle id，如 'main' / 'error' / 'true' / 'false' */
  name: string
  displayName: string
  description?: string
}

// ─── HTTP 路由 ────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/**
 * 声明式 HTTP 路由。
 *
 * motion.* 和 io.* 节点填写此字段后，执行引擎会自动把
 * WorkflowNode.params 序列化为请求体/查询参数发送给后端，
 * 不需要写任何自定义执行代码。
 *
 * 支持路径参数占位符：'/api/motion/axis/{axis}/home'
 * 占位符会从 params 中取对应 key 的值替换。
 */
export interface NodeRouting {
  method: HttpMethod
  /** 相对路径，基于 http://127.0.0.1:5000 */
  endpoint: string
  /**
   * 参数放置位置（默认 'body'）
   * - 'body'  → POST/PUT 请求体 JSON
   * - 'query' → GET 请求查询参数
   */
  paramLocation?: 'body' | 'query'
}

// ─── 节点分类 ─────────────────────────────────────────────────

/**
 * - trigger → 流程触发/入口节点
 * - motion  → 运动控制（调后端 HTTP）
 * - io      → IO 数字输入/输出
 * - flow    → 流程控制（条件/循环/延时，本地执行）
 * - data    → 数据处理（变量读写、格式转换）
 */
export type NodeCategory = 'trigger' | 'motion' | 'io' | 'flow' | 'data'

// ─── 节点蓝图 ─────────────────────────────────────────────────

/**
 * 节点类型的完整定义（静态蓝图）。
 *
 * 一种节点类型对应一个 NodeTypeDef 对象，写在
 * nodes/definitions/*.ts 里，通过 NODE_REGISTRY 注册。
 */
export interface NodeTypeDef {
  /** 全局唯一标识，格式 'category.action'，如 'motion.move-abs' */
  type: string
  category: NodeCategory
  displayName: string
  icon: string
  /** 主题色 hex，用于节点卡片头部 */
  color: string
  description: string
  /** 版本号，升级时递增以便兼容处理 */
  version: number
  /** 参数定义列表，按顺序渲染为配置表单 */
  params: NodeParam[]
  inputs: NodePort[]
  outputs: NodePort[]
  /** 参数默认值，key 与 params[].name 对应 */
  defaults: Record<string, unknown>
  /**
   * 声明式 HTTP 路由（motion.* / io.* 节点填写）。
   * 有此字段时引擎自动发 HTTP，无需 executeAs。
   */
  routing?: NodeRouting
  /**
   * 自定义执行标识（flow.* / data.* 节点填写）。
   * 引擎根据此值 switch-case 到对应本地函数。
   * @example 'condition' / 'loop' / 'delay' / 'setVariable'
   */
  executeAs?: string
}

// ─── 执行相关类型 ─────────────────────────────────────────────

/**
 * 节点间传递的数据载体（类似 N8N INodeExecutionData）。
 * 上游节点执行完后，后端响应的 JSON 放入 json 字段，
 * 下游节点通过表达式 $prev.xxx 读取。
 */
export interface NodeExecutionData {
  json: Record<string, unknown>
  meta?: {
    httpStatus?: number
    endpointCalled?: string
    durationMs?: number
  }
}

/**
 * 单个节点的执行结果。
 * success=true  → output 传给 main 端口的下游
 * success=false → error 传给 error 端口的下游
 */
export interface NodeExecutionResult {
  success: boolean
  output: NodeExecutionData
  error?: string
}

/**
 * 引擎内部构建的最终 HTTP 请求（由 routing + params 组合而成）。
 */
export interface NodeHttpRequest {
  method: HttpMethod
  url: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
}

// ─── 节点注册表 ───────────────────────────────────────────────

/** type 字符串 → NodeTypeDef 的映射，由 nodes/definitions/index.ts 导出 */
export type NodeRegistry = Record<string, NodeTypeDef>
