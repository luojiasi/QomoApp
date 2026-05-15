// ============ type 定义 ============

import { XYZ } from "@/shared/types"

/** 程序控制动作 */
export type StartProgramControlAction = 'pause' | 'resume' | 'reset' | 'estop' | 'skip'

// ============ interface 定义 ============

/** 产品 4P 中心旋转偏移 */
export interface Product4PCenterRotationPayload extends XYZ {}

/** 快速移动点位置 */
export interface QuickMovePositionPayload extends XYZ {}

/** 程序运行状态数据（WS 下行） */
export interface StartProgramStatusData {
  running: boolean
  paused: boolean
}
