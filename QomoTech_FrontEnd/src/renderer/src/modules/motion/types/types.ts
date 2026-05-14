// 程序控制动作
export type StartProgramControlAction = 'pause' | 'resume' | 'reset' | 'estop' | 'skip'
/** 仅支持三轴（XYZ）或五轴（XYZUR），与后端 axis_count Literal[3,5] 对齐 */
export type ControllerAxisCount = 3 | 5
export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'
export type 运动模式 = 'relative' | 'absolute'

// 在线命令
export type CommonOnlineCommand = { 
    description: string 
    command: string 
    usage: string
}

/** 通用 XYZ 坐标 */
export type XYZ = {
    X: number
    Y: number
    Z: number
  }

