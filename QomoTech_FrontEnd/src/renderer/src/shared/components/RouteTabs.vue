<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import logo from '@resources/icon.png'
import { toggleColorScheme } from '@/shared/composables/useAppColorScheme'
import { useAuthStore } from '@/stores/auth'
import type { RouteShortcut } from '@/types/settings'
import SvgIcon from './SvgIcon.vue'

const props = withDefaults(
  defineProps<{
    links: RouteShortcut[]
    showHomeLink?: boolean
  }>(),
  {
    showHomeLink: true
  }
)

const authStore = useAuthStore()
const route = useRoute()

/** 普通用户仅可见：配方管理、帮助界面；管理员可见全部 */
const USER_VISIBLE_PATHS = new Set(['/recipe-management', '/help','/create-5p'])

const visibleLinks = computed(() => {
  if (authStore.isAdmin) {
    return props.links
  }
  return props.links.filter((item) => USER_VISIBLE_PATHS.has(item.path))
})

</script>

<template>
  <!-- 与 Home 工艺面板一致：页面用 --app-bg，导航条用 --app-card，比背景更亮 -->
  <nav
    class="flex items-center justify-between rounded-2xl border border-(--app-border) bg-(--app-card) p-1 text-(--app-text-primary) shadow-[0_25px_50px_-12px_rgba(15,23,42,0.12),0_10px_20px_-6px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55),0_10px_20px_-6px_rgba(0,0,0,0.45)] dark:ring-white/10"
  >
    <div class="shrink-0">
      <button
        type="button"
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-1 transition-colors hover:bg-slate-100/90 dark:hover:bg-white/10"
        title="切换浅色 / 深色"
        @click="toggleColorScheme"
      >
        <img :src="logo" alt="Logo" class="pointer-events-none h-6 w-6" />
      </button>
    </div>

    <div class="flex flex-1 flex-wrap gap-x-4 gap-y-2 pl-6">
      <!-- <RouterLink
        v-if="effectiveShowHomeLink"
        to="/home"
        class="transition-colors"
        :class="
          route.path === '/home'
            ? 'font-medium text-sky-600 dark:text-sky-400'
            : 'text-(--app-text-secondary) hover:text-(--app-text-primary)'
        "
      >
        首页
      </RouterLink> -->

      <RouterLink
        v-for="item in visibleLinks"
        :key="item.path"
        :to="item.path"
        class="transition-colors"
        :class="
          route.path === item.path
            ? 'font-medium text-sky-600 dark:text-sky-400'
            : 'text-(--app-text-secondary) hover:text-(--app-text-primary)'
        "
      >
          <div class="flex flex-col items-center">
            <SvgIcon :icon-name="item.title" class-name="text-sm" />
            <span class="text-xs">{{ item.name }}</span>
          </div>

      </RouterLink>
    </div>
  </nav>
</template>
