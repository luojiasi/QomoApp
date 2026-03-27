import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { verify } from 'node:crypto'
import { app } from 'electron'
import { getDeviceFingerprint } from './device'
import {
  LICENSE_CHECK_INTERVAL_MS,
  LICENSE_ROLLBACK_TOLERANCE_MS,
  LICENSE_VALID_DAYS,
  type ActivatedLicenseRecord,
  type LicenseActivationResult,
  type LicenseStatus,
  type LicenseStatusCode,
  type SignedLicenseEnvelope,
  type SignedLicensePayload
} from './types/license'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const LICENSE_FILE_NAME = 'license.json'
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAdxADOg64EXyCwv3KF4lHPi19VRYhQEDqVwrcmcld8eU=
-----END PUBLIC KEY-----`

let licenseMonitor: ReturnType<typeof setInterval> | null = null

const getLicenseFilePath = (): string => join(app.getPath('userData'), LICENSE_FILE_NAME)

const serializePayload = (payload: SignedLicensePayload): string =>
  JSON.stringify({
    licenseId: payload.licenseId,
    deviceFingerprint: payload.deviceFingerprint,
    validDays: payload.validDays,
    issuedAt: payload.issuedAt
  })

const toBaseStatus = (
  code: LicenseStatusCode,
  message: string,
  fingerprint: string,
  record?: ActivatedLicenseRecord | null
): LicenseStatus => {
  const remainingDays =
    record && record.expireAt > Date.now()
      ? Math.ceil((record.expireAt - Date.now()) / DAY_IN_MS)
      : null

  return {
    valid: code === 'valid',
    code,
    message,
    requiresActivation: code !== 'valid',
    deviceFingerprint: fingerprint,
    activatedAt: record?.activatedAt ?? null,
    expireAt: record?.expireAt ?? null,
    licenseId: record?.licenseId ?? null,
    remainingDays
  }
}

const decodeLicenseString = (licenseKey: string): string => {
  const normalized = licenseKey.trim()

  if (normalized.startsWith('{')) {
    return normalized
  }

  const base64 = normalized.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const isValidPayload = (payload: SignedLicensePayload): boolean =>
  Boolean(
    payload.licenseId &&
      payload.deviceFingerprint &&
      Number.isFinite(payload.validDays) &&
      payload.validDays > 0 &&
      Number.isFinite(payload.issuedAt) &&
      payload.issuedAt > 0
  )

const verifyEnvelope = (envelope: SignedLicenseEnvelope): boolean => {
  try {
    return verify(
      null,
      Buffer.from(serializePayload(envelope.payload)),
      PUBLIC_KEY,
      Buffer.from(envelope.signature, 'base64')
    )
  } catch {
    return false
  }
}

const readLicenseRecord = async (): Promise<ActivatedLicenseRecord | null> => {
  try {
    const fileContent = await fs.readFile(getLicenseFilePath(), 'utf8')
    return JSON.parse(fileContent) as ActivatedLicenseRecord
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException
    if (fileError.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

const writeLicenseRecord = async (record: ActivatedLicenseRecord): Promise<void> => {
  await fs.writeFile(getLicenseFilePath(), JSON.stringify(record, null, 2), 'utf8')
}

const deleteLicenseRecord = async (): Promise<void> => {
  try {
    await fs.unlink(getLicenseFilePath())
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException
    if (fileError.code !== 'ENOENT') {
      throw error
    }
  }
}

const markInvalidReason = async (
  record: ActivatedLicenseRecord,
  reason: Exclude<LicenseStatusCode, 'valid' | 'missing'>
): Promise<ActivatedLicenseRecord> => {
  const nextRecord = {
    ...record,
    invalidReason: reason
  }

  await writeLicenseRecord(nextRecord)
  return nextRecord
}

const validateRecord = async (
  record: ActivatedLicenseRecord,
  fingerprint: string
): Promise<LicenseStatus> => {
  if (!isValidPayload(record)) {
    return toBaseStatus('invalid_payload', '授权文件内容无效，请重新输入密钥。', fingerprint, record)
  }

  if (!verifyEnvelope({ payload: record, signature: record.signature })) {
    const nextRecord = await markInvalidReason(record, 'invalid_signature')
    return toBaseStatus(
      'invalid_signature',
      '密钥签名校验失败，请重新输入密钥。',
      fingerprint,
      nextRecord
    )
  }

  if (record.deviceFingerprint !== fingerprint) {
    const nextRecord = await markInvalidReason(record, 'device_mismatch')
    return toBaseStatus(
      'device_mismatch',
      '当前设备与授权绑定设备不一致，请重新输入密钥。',
      fingerprint,
      nextRecord
    )
  }

  if (record.invalidReason === 'time_rollback') {
    return toBaseStatus(
      'time_rollback',
      '检测到系统时间被回拨，请重新输入密钥。',
      fingerprint,
      record
    )
  }

  const now = Date.now()

  if (now + LICENSE_ROLLBACK_TOLERANCE_MS < record.lastVerifiedWallClock) {
    const nextRecord = await markInvalidReason(record, 'time_rollback')
    return toBaseStatus(
      'time_rollback',
      '检测到系统时间被回拨，请重新输入密钥。',
      fingerprint,
      nextRecord
    )
  }

  if (now >= record.expireAt) {
    const nextRecord = await markInvalidReason(record, 'expired')
    return toBaseStatus('expired', '当前密钥已过期，请重新输入密钥。', fingerprint, nextRecord)
  }

  const nextRecord = {
    ...record,
    lastVerifiedWallClock: now,
    lastVerifiedMonotonic: performance.now(),
    invalidReason: undefined
  }

  await writeLicenseRecord(nextRecord)

  return toBaseStatus('valid', '授权有效。', fingerprint, nextRecord)
}

export const getLicenseStatus = async (): Promise<LicenseStatus> => {
  const fingerprint = getDeviceFingerprint()

  try {
    const record = await readLicenseRecord()

    if (!record) {
      return toBaseStatus('missing', '当前设备尚未激活，请输入密钥。', fingerprint)
    }

    return await validateRecord(record, fingerprint)
  } catch {
    return toBaseStatus('parse_error', '授权文件已损坏，请重新输入密钥。', fingerprint)
  }
}

export const activateLicense = async (licenseKey: string): Promise<LicenseActivationResult> => {
  const fingerprint = getDeviceFingerprint()

  try {
    const decoded = decodeLicenseString(licenseKey)
    const envelope = JSON.parse(decoded) as SignedLicenseEnvelope

    if (!envelope.payload || !envelope.signature || !isValidPayload(envelope.payload)) {
      const status = toBaseStatus('invalid_payload', '密钥内容无效，请检查后重试。', fingerprint)
      return {
        success: false,
        message: status.message,
        status
      }
    }

    if (!verifyEnvelope(envelope)) {
      const status = toBaseStatus('invalid_signature', '密钥签名无效，请检查后重试。', fingerprint)
      return {
        success: false,
        message: status.message,
        status
      }
    }

    if (envelope.payload.deviceFingerprint !== fingerprint) {
      const status = toBaseStatus(
        'device_mismatch',
        '该密钥不属于当前设备，请使用本机对应的密钥。',
        fingerprint
      )
      return {
        success: false,
        message: status.message,
        status
      }
    }

    const activatedAt = Date.now()
    const validDays = envelope.payload.validDays || LICENSE_VALID_DAYS
    const record: ActivatedLicenseRecord = {
      ...envelope.payload,
      validDays,
      signature: envelope.signature,
      activatedAt,
      expireAt: activatedAt + validDays * DAY_IN_MS,
      lastVerifiedWallClock: activatedAt,
      lastVerifiedMonotonic: performance.now()
    }

    await writeLicenseRecord(record)

    const status = await getLicenseStatus()
    return {
      success: status.valid,
      message: status.valid ? '密钥激活成功。' : status.message,
      status
    }
  } catch {
    const status = toBaseStatus('parse_error', '密钥格式错误，请重新输入。', fingerprint)
    return {
      success: false,
      message: status.message,
      status
    }
  }
}

export const clearLicense = async (): Promise<LicenseStatus> => {
  await deleteLicenseRecord()
  return getLicenseStatus()
}

export const getCurrentDeviceFingerprint = (): string => getDeviceFingerprint()

export const startLicenseMonitor = (): void => {
  if (licenseMonitor) {
    return
  }

  licenseMonitor = setInterval(() => {
    void getLicenseStatus()
  }, LICENSE_CHECK_INTERVAL_MS)

  licenseMonitor.unref()
}
