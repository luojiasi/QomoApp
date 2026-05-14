/**
 * modules/motion/api/index.ts
 *
 * [已迁移] 运动控制 API 从 core/api/motionApi 重导出。
 * 兼容性：所有旧 import { connectMotion } from '@/modules/motion/api' 仍然有效。
 */

export {
  // 连接
  buildMotionConnectRequestPayload,
  connectMotion,
  connectMotionWithControllerSettings,
  // 轴参数
  buildMotionAllAxesParamsRequestPayload,
  setMotionAllAxesParams,
  setMotionAllAxesParamsWithControllerSettings,
  // 轴运动
  getMotionPosition,
  emergencyStopMotion,
  zeroMotionAxis,
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateUAxisByAngle,
  rotateRAxisByTurns,
  // IO
  setMotionIoOutput,
  getMotionIoOutput,
  getMotionIoOutputsStatus,
  getMotionIoInput,
  getMotionIoInputsStatus,
  // 程序执行
  startProgram,
  syncProduct4PCenterRotation,
  getProduct4PCenterRotation,
  getStartProgramStatus,
  startProgramControl,
  // 设置持久化
  getControllerSettingsFromFile,
  saveControllerSettingsToFile,
} from '@/core/api/motionApi'
