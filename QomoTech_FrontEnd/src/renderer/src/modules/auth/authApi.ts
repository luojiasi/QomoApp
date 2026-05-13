import type { LicenseActivationResult, LicenseStatus } from './licenseTypes'

/** 通过 preload IPC 桥获取当前许可证状态 */
export const fetchLicenseStatus = (): Promise<LicenseStatus> =>
  window.api.license.getStatus()

/** 通过 preload IPC 桥提交许可证密钥进行激活 */
export const activateLicense = (licenseKey: string): Promise<LicenseActivationResult> =>
  window.api.license.activate(licenseKey)

/** 通过 preload IPC 桥清除许可证 */
export const clearLicense = (): Promise<LicenseStatus> =>
  window.api.license.clear()

/** 通过 preload IPC 桥获取本机设备指纹 */
export const fetchLicenseDeviceFingerprint = (): Promise<string> =>
  window.api.license.getDeviceFingerprint()
