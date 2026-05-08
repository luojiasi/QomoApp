import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LicenseActivationResult, LicenseStatus } from '../types/license'

const createEmptyStatus = (): LicenseStatus => ({
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

export const useLicenseStore = defineStore('license', () => {
  const status = ref<LicenseStatus>(createEmptyStatus())
  const initialized = ref(false)
  const loading = ref(false)

  const isValid = computed(() => status.value.valid)
  const requiresActivation = computed(() => status.value.requiresActivation)

  const refreshStatus = async (): Promise<LicenseStatus> => {
    loading.value = true

    try {
      status.value = await window.api.license.getStatus()
      initialized.value = true
      return status.value
    } finally {
      loading.value = false
    }
  }

  const activate = async (licenseKey: string): Promise<LicenseActivationResult> => {
    loading.value = true

    try {
      const result = await window.api.license.activate(licenseKey)
      status.value = result.status
      initialized.value = true
      return result
    } finally {
      loading.value = false
    }
  }

  const clearLicense = async (): Promise<LicenseStatus> => {
    loading.value = true

    try {
      status.value = await window.api.license.clear()
      initialized.value = true
      return status.value
    } finally {
      loading.value = false
    }
  }

  const syncDeviceFingerprint = async (): Promise<string> => {
    const deviceFingerprint = await window.api.license.getDeviceFingerprint()
    status.value = {
      ...status.value,
      deviceFingerprint
    }
    return deviceFingerprint
  }

  return {
    status,
    initialized,
    loading,
    isValid,
    requiresActivation,
    refreshStatus,
    activate,
    clearLicense,
    syncDeviceFingerprint
  }
})
