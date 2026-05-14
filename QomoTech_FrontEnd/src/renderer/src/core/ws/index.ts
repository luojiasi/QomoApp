/**
 * core/ws/index.ts
 *
 * WebSocket 通道层统一导出入口。
 */

export {
  WsClient,
  getBackendWsBaseUrl,
  getMotionStatusWsUrl,
  getCameraStreamWsUrl,
  getProgramStatusWsUrl,
  type WsClientOptions
} from './WsClient'

export {
  startMotionChannel,
  stopMotionChannel,
  useMotionChannelState,
  waitControllerConnected,
  isControllerConnected,
  getMotionStateSnapshot
} from './motionChannel'

export {
  startCameraChannel,
  stopCameraChannel,
  suspendCameraChannel,
  resumeCameraChannel,
  useCameraChannelState
} from './cameraChannel'

export {
  startProgramChannel,
  stopProgramChannel,
  useProgramChannelState
} from './programChannel'
