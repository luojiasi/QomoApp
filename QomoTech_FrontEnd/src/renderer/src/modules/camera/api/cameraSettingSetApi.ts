// 已迁移至 @/core/api/cameraApi。保留此文件以确保旧 import 不报错。
export {
  fetchCameraDevices,
  connectCamera,
  disconnectCamera,
  getCameraStatus,
  setCameraExposure,
  setCameraFrameSpeed,
  setCameraMirror,
  setCameraWhiteBalance,
  getCameraFrameUrl,
  bootstrapCameraSettings
} from '@/core/api/cameraApi'
