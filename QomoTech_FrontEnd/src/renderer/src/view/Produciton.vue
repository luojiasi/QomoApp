<script setup lang="ts">
import { computed, onMounted } from 'vue'
import RouteTabs from '../components/RouteTabs.vue'
import { useReservePages } from '../composables/useSettingsPages'
import { useReservePagesStore } from '../stores/settings'

const reserveStore = useReservePagesStore()
const { navigationLinks, getReservePageByPath } = useReservePages()

const page = computed(() => getReservePageByPath('/reserve-workbench-c'))

onMounted(async () => {
  await reserveStore.loadReservePages()
})
</script>

<template>
  <div class="app-page min-h-screen px-6 py-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="app-card rounded-2xl p-8 shadow-lg">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="app-text-secondary text-sm">扩展工作台</p>
            <h1 class="app-text-primary mt-1 text-3xl font-bold">{{ page.title }}</h1>
            <p class="app-text-secondary mt-3 max-w-3xl text-sm leading-6">
              {{ page.description }}
            </p>
          </div>

          <RouterLink
            to="/home"
            class="rounded-xl bg-slate-800 px-5 py-3 text-center font-medium text-white transition hover:bg-slate-900"
          >
            返回首页
          </RouterLink>
        </div>
        <div class="mt-6">
          <RouteTabs :links="navigationLinks" />
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-xl font-semibold">预留方向</h2>
          <div class="mt-5 grid gap-3 md:grid-cols-3">
            <div
              v-for="item in page.readyFor"
              :key="item"
              class="app-card-soft rounded-xl p-4 text-sm"
            >
              <p class="app-text-primary font-medium">{{ item }}</p>
            </div>
          </div>

        </section>

        <section class="app-card rounded-2xl p-6 shadow-sm">
          <h2 class="app-text-primary text-xl font-semibold">接入说明</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="app-card-soft rounded-xl p-4">
              <p class="app-text-primary font-medium">工具区</p>
              <p class="app-text-secondary mt-2">
                可承接系统维护、调试动作、参数导入导出和诊断工具组件。
              </p>
            </div>
            <div class="app-card-soft rounded-xl p-4">
              <p class="app-text-primary font-medium">日志区</p>
              <p class="app-text-secondary mt-2">
                可承接日志查询、审计记录、操作轨迹或错误栈明细组件。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
