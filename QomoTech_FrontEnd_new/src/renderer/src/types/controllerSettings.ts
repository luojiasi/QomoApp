export type ControllerTransport = 'ethernet' | 'rs232' | 'rs485' | 'can' | 'ethercat'

export type ControllerAxisCount = 3 | 5

export interface ControllerCommunicationSettings {
  controllerModel: 'ZMC406-V2' | 'QomoTech406V2'
  transport: ControllerTransport
  ipAddress: string
  enableAxes: string[]
  axisCount: ControllerAxisCount
}

export interface ControllerAxisSettings {
  axisNo: number
  axisName: string
}

export interface ControllerParameters {
  communication: ControllerCommunicationSettings
  axes: ControllerAxisSettings[]
}
