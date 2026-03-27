<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { useLicenseStore } from '../stores/license'

const router = useRouter()
const licenseStore = useLicenseStore()
const { success, error, info } = useNotification()

const licenseKey = ref('')

const handleActivate = async () => {
  if (!licenseKey.value.trim()) {
    error('请输入密钥')
    return
  }

  const result = await licenseStore.activate(licenseKey.value)

  if (!result.success) {
    error(result.message)
    return
  }

  success(result.message)
  await router.push('/login')
}

const handleRefresh = async () => {
  const status = await licenseStore.refreshStatus()

  if (status.valid) {
    info('当前授权仍然有效')
    await router.push('/login')
  }
}

onMounted(async () => {
  await licenseStore.syncDeviceFingerprint()
  await handleRefresh()
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="app-card mx-auto max-w-3xl rounded-2xl p-8 shadow-lg">
      <div class="mb-8">
        <h1 class="app-text-primary text-3xl font-bold">软件授权</h1>
        <p class="app-text-secondary mt-2 text-sm">
          当前软件采用离线授权模式。若授权已到期、设备不匹配或检测到时间回拨，需要重新输入密钥。
        </p>
      </div>

      <div class="app-card-soft rounded-2xl p-6">
        <p class="app-text-secondary text-sm">当前授权状态</p>
        <p class="app-text-primary mt-2 text-lg font-semibold">
          {{ licenseStore.status.message }}
        </p>
        <p class="app-text-secondary mt-2 text-sm">状态码：{{ licenseStore.status.code }}</p>
        <p class="app-text-secondary mt-4 text-sm">设备指纹</p>
        <p class="mt-1 break-all rounded-xl bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100">
          {{ licenseStore.status.deviceFingerprint || '正在读取...' }}
        </p>
        <p v-if="licenseStore.status.expireAt" class="app-text-secondary mt-4 text-sm">
          到期时间：{{ new Date(licenseStore.status.expireAt).toLocaleString() }}
        </p>
      </div>

      <div class="mt-6 space-y-4">
        <label class="app-text-secondary block text-sm font-medium">离线密钥</label>
        <textarea
          v-model="licenseKey"
          rows="7"
          placeholder="请输入管理员为当前设备生成的离线密钥"
          class="app-input w-full rounded-2xl border px-4 py-3 font-mono text-sm outline-none transition focus:border-blue-500"
        ></textarea>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            :disabled="licenseStore.loading"
            @click="handleActivate"
          >
            激活密钥
          </button>

          <button
            type="button"
            class="rounded-xl bg-slate-200 px-5 py-3 font-medium text-slate-800 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            :disabled="licenseStore.loading"
            @click="handleRefresh"
          >
            刷新状态
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
