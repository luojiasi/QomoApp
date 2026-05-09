import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LicenseActivationResult, LicenseStatus } from '../types/license'
import { createDefaultLicenseStatus } from '../configs/settings'
import {
  activateLicense,
  clearLicense as clearLicenseApi,
  fetchLicenseDeviceFingerprint,
  fetchLicenseStatus
} from '../api/license'

const createEmptyStatus = createDefaultLicenseStatus

export const useLicenseStore = defineStore('license', () => {
  const status = ref<LicenseStatus>(createEmptyStatus())
  const initialized = ref(false)
  const loading = ref(false)

  const isValid = computed(() => status.value.valid)
  const requiresActivation = computed(() => status.value.requiresActivation)

  const refreshStatus = async (): Promise<LicenseStatus> => {
    loading.value = true

    try {
      status.value = await fetchLicenseStatus()
      initialized.value = true
      return status.value
    } finally {
      loading.value = false
    }
  }

  const activate = async (licenseKey: string): Promise<LicenseActivationResult> => {
    loading.value = true

    try {
      const result = await activateLicense(licenseKey)
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
      status.value = await clearLicenseApi()
      initialized.value = true
      return status.value
    } finally {
      loading.value = false
    }
  }

  const syncDeviceFingerprint = async (): Promise<string> => {
    const deviceFingerprint = await fetchLicenseDeviceFingerprint()
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
