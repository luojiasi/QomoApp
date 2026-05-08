import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import os from 'node:os'

const runCommand = (file: string, args: string[]): string => {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      windowsHide: true
    }).trim()
  } catch {
    return ''
  }
}

const getWindowsMachineGuid = (): string => {
  const output = runCommand('reg', [
    'query',
    'HKLM\\SOFTWARE\\Microsoft\\Cryptography',
    '/v',
    'MachineGuid'
  ])

  const matchedValue = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)
  return matchedValue?.[1]?.trim() ?? ''
}

const getWindowsBiosUuid = (): string => {
  const output = runCommand('powershell', [
    '-NoProfile',
    '-Command',
    '(Get-CimInstance Win32_ComputerSystemProduct).UUID'
  ])

  return output.split(/\r?\n/).find((line) => line.trim())?.trim() ?? ''
}

const getPreferredMacAddress = (): string => {
  const interfaces = os.networkInterfaces()

  for (const interfaceDetails of Object.values(interfaces)) {
    if (!interfaceDetails) {
      continue
    }

    for (const detail of interfaceDetails) {
      if (
        !detail.internal &&
        detail.mac &&
        detail.mac !== '00:00:00:00:00:00'
      ) {
        return detail.mac
      }
    }
  }

  return ''
}

const buildFingerprintSeed = (): string => {
  const seedParts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    getWindowsMachineGuid(),
    getWindowsBiosUuid(),
    getPreferredMacAddress()
  ]

  return seedParts.filter(Boolean).join('|')
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
