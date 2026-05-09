import { getBackendBaseUrl } from './base'

export const getBackendWsBaseUrl = () => {
  const baseUrl = getBackendBaseUrl()

  if (!baseUrl) {
    if (typeof window === 'undefined') return ''
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }

  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace(/^https:\/\//, 'wss://')
  }

  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace(/^http:\/\//, 'ws://')
  }

  return baseUrl
}

export const getCameraStreamWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/camera/stream` : '/ws/camera/stream'
}

export const getStartProgramStatusWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/api/startProgram/ws` : '/api/startProgram/ws'
}
