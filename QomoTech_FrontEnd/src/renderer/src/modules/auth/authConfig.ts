import type { AccountInfo } from './authTypes'
import type { LicenseStatus } from './licenseTypes'

export const DEFAULT_ADMIN_ACCOUNT: AccountInfo = {
  username: 'admin',
  password: 'admin123'
}

export const DEFAULT_USER_ACCOUNT: AccountInfo = {
  username: 'user',
  password: '123456'
}

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
