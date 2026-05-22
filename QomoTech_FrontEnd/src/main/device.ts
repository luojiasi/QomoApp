import { createHash } from 'node:crypto'
import os from 'node:os'

const buildFingerprintSeed = (): string => {
  const seedParts = [
    os.hostname(),
    os.platform(),
    os.arch(),
  ]

  return seedParts.join('|')
}

let cachedFingerprint = ''

export const getDeviceFingerprint = (): string => {
  if (cachedFingerprint) {
    return cachedFingerprint
  }

  const rawSeed = buildFingerprintSeed()
  cachedFingerprint = createHash('sha256').update(rawSeed).digest('hex')
  return cachedFingerprint
}
