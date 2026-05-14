<script setup lang="ts">
import { onMounted, ref,onUnmounted} from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/shared/composables/useNotification'
import { useAuthStore } from '../stores/useAuthStore'
import { useLicenseStore } from '../stores/licenseStore'
import { subscribeGlobalKeyboard } from '@/shared/composables/useGlobalKeyboard'

const unsubscribeKeyboard = subscribeGlobalKeyboard((e) => {
  if (e.repeat) return
  const ch = e.key.length === 1 ? e.key.toUpperCase() : ''
  if (ch !== 'Q'&& !e.ctrlKey && !e.shiftKey) return
  e.preventDefault()
  console.log('helpQ')
})


const router = useRouter()
const authStore = useAuthStore()
const licenseStore = useLicenseStore()
const { success, error, info } = useNotification()
const editUsername = ref(authStore.userAccount.username)
const editPassword = ref(authStore.userAccount.password)
const updateMessage = ref('')
const licenseKey = ref('')

const handleLogout = async () => {
  authStore.logout()
  await router.push('/login')
}

const handleUpdateUserAccount = () => {
  const result = authStore.updateUserAccount(editUsername.value, editPassword.value)
  updateMessage.value = result.message

  if (result.success) {
    editUsername.value = authStore.userAccount.username
    editPassword.value = authStore.userAccount.password
    success(result.message)
  } else {
    error(result.message)
  }
}

const handleUpdateLicense = async () => {
  if (!authStore.isAdmin) {
    error('只有管理员可以修改密钥')
    return
  }

  if (!licenseKey.value.trim()) {
    error('请输入新的离线密钥')
    return
  }

  const result = await licenseStore.activate(licenseKey.value)

  if (!result.success) {
    error(result.message)
    return
  }

  licenseKey.value = ''
  success('密钥已更新')
}

const handleClearLicense = async () => {
  if (!authStore.isAdmin) {
    error('只有管理员可以清空密钥')
    return
  }

  await licenseStore.clearLicense()
  info('当前授权已清除，请重新输入密钥')
  authStore.logout()
  await router.push('/license')
}

onMounted(async () => {
  await licenseStore.refreshStatus()
})

onUnmounted(() => {
  unsubscribeKeyboard()
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-5xl space-y-6">
      <div class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="app-text-secondary text-sm">系统帮助与维护</p>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">Help</h1>
            <p class="app-text-secondary mt-3 text-sm leading-6">
              这里承接原 `Home` 页面的授权、账号与管理员相关内容，后续也可以继续扩展帮助说明组件。
            </p>
          </div>

          <button
            type="button"
            class="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white transition hover:bg-slate-900"
            @click="handleLogout"
          >
            退出登录
          </button>
        </div>
      </div>

      <div class="app-card-soft rounded-2xl p-6">
        <p class="app-text-primary text-lg">
          欢迎登录
        </p>
        <p class="app-text-secondary mt-3 text-sm">
          当前身份：
          <span class="app-text-primary font-medium">
            {{ authStore.isAdmin ? '管理员' : '普通用户' }}
          </span>
        </p>
        <p class="app-text-secondary mt-2 text-sm">
          管理员状态：{{ authStore.isAdmin?'是':'否' }}，用户状态：{{ authStore.isUser?'是':'否' }}
        </p>
      </div>

      <div class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">授权信息</h2>
        <p class="app-text-secondary mt-2 text-sm">
          当前授权状态：{{ licenseStore.status.message }}
        </p>
        <p class="app-text-secondary mt-2 text-sm">
          设备指纹：{{ licenseStore.status.deviceFingerprint }}
        </p>
        <p v-if="licenseStore.status.licenseId" class="app-text-secondary mt-2 text-sm">
          授权编号：{{ licenseStore.status.licenseId }}
        </p>
        <p v-if="licenseStore.status.expireAt" class="app-text-secondary mt-2 text-sm">
          到期时间：{{ new Date(licenseStore.status.expireAt).toLocaleString() }}
        </p>
        <p v-if="licenseStore.status.remainingDays !== null" class="app-text-secondary mt-2 text-sm">
          剩余天数：{{ licenseStore.status.remainingDays }}
        </p>
      </div>

      <div v-if="authStore.isAdmin" class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">管理员用户设置</h2>
        <p class="app-text-secondary mt-2 text-sm">
          你当前是管理员，可以修改本地普通用户的用户名和密码。
        </p>

        <div class="app-card-soft mt-4 rounded-xl p-4 text-sm app-text-secondary">
          当前本地用户：{{ authStore.userAccount.username }} / {{ authStore.userAccount.password }}
        </div>

        <div class="mt-5 space-y-4">
          <div>
            <label class="app-text-secondary mb-2 block text-sm font-medium">用户用户名</label>
            <input
              v-model="editUsername"
              type="text"
              class="app-input w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label class="app-text-secondary mb-2 block text-sm font-medium">用户密码</label>
            <input
              v-model="editPassword"
              type="text"
              class="app-input w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500"
            />
          </div>

          <p v-if="updateMessage" class="app-text-secondary text-sm">
            {{ updateMessage }}
          </p>

          <button
            type="button"
            class="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            @click="handleUpdateUserAccount"
          >
            保存用户账号
          </button>
        </div>
      </div>

      <div v-if="authStore.isAdmin" class="app-card rounded-2xl p-6 shadow-sm">
        <h2 class="app-text-primary text-xl font-semibold">管理员密钥设置</h2>
        <p class="app-text-secondary mt-2 text-sm">
          仅管理员可以替换当前设备的离线密钥或清空密钥。
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="app-text-secondary mb-2 block text-sm font-medium">新的离线密钥</label>
            <textarea
              v-model="licenseKey"
              rows="6"
              class="app-input w-full rounded-2xl border px-4 py-3 font-mono text-sm outline-none transition focus:border-blue-500"
            ></textarea>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
              @click="handleUpdateLicense"
            >
              更新密钥
            </button>

            <button
              type="button"
              class="rounded-xl bg-red-500 px-5 py-3 font-medium text-white transition hover:bg-red-600"
              @click="handleClearLicense"
            >
              清空密钥
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
