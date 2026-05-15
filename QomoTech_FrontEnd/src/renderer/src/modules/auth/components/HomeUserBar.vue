<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'
import SvgIcon from '@/shared/components/SvgIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const roleLabel = computed(() => (authStore.isAdmin ? '管理员' : '使用者'))

const handleLogout = async () => {
  authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <div class="app-card-soft flex items-center gap-2 rounded-xl px-2 text-sm">
      <SvgIcon icon-name="icon-yonghu" class-name="text-1xl" />
      <span class="app-text-primary font-medium">: {{ roleLabel }}</span>
    </div>
    <button
      type="button"
      class="rounded-xl bg-slate-800 px-2 py-1 font-medium text-white transition hover:bg-slate-900"
      @click="handleLogout"
    >
      退出登录
    </button>
  </div>
</template>
