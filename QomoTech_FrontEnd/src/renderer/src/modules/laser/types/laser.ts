export interface LaserApplyPayload {
  laserManufacturer?: string
  laserPower?: number
  laserFrequency?: number
  laserCurrent?: number
}

export interface LaserSettingsPayload {
  manufacturer: string
  port: string
  power: string
  frequency: string
  current: string
}

export interface Rs232PortInfo {
  device: string
  name: string
  description: string
}
