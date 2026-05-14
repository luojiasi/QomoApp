import type { LicenseStatus } from '../types/license'

export const createDefaultLicenseStatus = (): LicenseStatus => ({
  valid: false,
  code: 'missing',
  message: '当前设备尚未激活，请输入密钥。',
  requiresActivation: true,
  deviceFingerprint: '',
  activatedAt: null,
  expireAt: null,
  licenseId: null,
  remainingDays: null
})
