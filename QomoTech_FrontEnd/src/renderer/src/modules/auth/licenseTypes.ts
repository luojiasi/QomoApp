export type LicenseStatusCode =
  | 'valid'
  | 'missing'
  | 'expired'
  | 'time_rollback'
  | 'device_mismatch'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'parse_error'

export type LicenseStatus = {
  valid: boolean
  code: LicenseStatusCode
  message: string
  requiresActivation: boolean
  deviceFingerprint: string
  activatedAt: number | null
  expireAt: number | null
  licenseId: string | null
  remainingDays: number | null
}

export type LicenseActivationResult = {
  success: boolean
  message: string
  status: LicenseStatus
}
