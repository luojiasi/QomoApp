export const LICENSE_VALID_DAYS = 90
export const LICENSE_CHECK_INTERVAL_MS = 60_000
export const LICENSE_ROLLBACK_TOLERANCE_MS = 120_000

export type LicenseStatusCode =
  | 'valid'
  | 'missing'
  | 'expired'
  | 'time_rollback'
  | 'device_mismatch'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'parse_error'

export type SignedLicensePayload = {
  licenseId: string
  deviceFingerprint: string
  validDays: number
  issuedAt: number
}

export type SignedLicenseEnvelope = {
  payload: SignedLicensePayload
  signature: string
}

export type ActivatedLicenseRecord = SignedLicensePayload & {
  activatedAt: number
  expireAt: number
  signature: string
  lastVerifiedWallClock: number
  lastVerifiedMonotonic: number
  invalidReason?: Exclude<LicenseStatusCode, 'valid' | 'missing'>
}

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
