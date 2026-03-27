import { randomUUID, sign } from 'node:crypto'

const DEV_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIM7tewKsd9m5pj51zvd+xeIiqvEVZpDwEPKgepRfm0e6
-----END PRIVATE KEY-----`

const args = process.argv.slice(2)

const getArgValue = (flag, fallback = '') => {
  const inlineArg = args.find((item) => item.startsWith(`${flag}=`))

  if (inlineArg) {
    return inlineArg.slice(flag.length + 1)
  }

  const index = args.indexOf(flag)
  if (index === -1) {
    return fallback
  }

  return args[index + 1] ?? fallback
}

const deviceFingerprint = getArgValue('--device')
const validDays = Number.parseInt(getArgValue('--days', '90'), 10)
const licenseId = getArgValue('--license-id', randomUUID())

if (!deviceFingerprint) {
  console.error('用法: node scripts/generate-license.mjs --device <fingerprint> [--days 90] [--license-id xxx]')
  process.exit(1)
}

const payload = {
  licenseId,
  deviceFingerprint,
  validDays,
  issuedAt: Date.now()
}

const signature = sign(null, Buffer.from(JSON.stringify(payload)), DEV_PRIVATE_KEY).toString('base64')
const licenseKey = Buffer.from(
  JSON.stringify({
    payload,
    signature
  })
)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '')

console.log('licenseId:', licenseId)
console.log('deviceFingerprint:', deviceFingerprint)
console.log('validDays:', validDays)
console.log('licenseKey:')
console.log(licenseKey)
