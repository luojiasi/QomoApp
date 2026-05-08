<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { home } from '../utils/motionApi'
import { useNotification } from '@renderer/composables/useNotification'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
const { success, error } = useNotification()
const controllerStore = useControllerSettingsStore()

const isMovingHome = ref(false)
const persistHomeStateToLocal = () => {
  controllerStore.saveHomeState({
    ISARRIVEDHOME: ISARRIVEDHOME.value,
    AUTO_HOME_ON_START: autoHomeOnStart.value
  })
}
const homeState = controllerStore.loadHomeState()
const isSetHome = ref(homeState.ISARRIVEDHOME ? '回零完成' : '未回零')
const ISARRIVEDHOME = ref<boolean>(homeState.ISARRIVEDHOME)
const autoHomeOnStart = ref<boolean>(homeState.AUTO_HOME_ON_START)
watch(
  () => isSetHome.value,
  (status) => {
    ISARRIVEDHOME.value = status === '回零完成'
    persistHomeStateToLocal()
  },
  { immediate: true }
)
watch(() => autoHomeOnStart.value, persistHomeStateToLocal)

const homeStatusClass = computed(() => {
  if (isSetHome.value === '回零中') {
    return 'border-yellow-500 bg-yellow-500 text-white shadow-yellow-900/20'
  }
  if (isSetHome.value === '回零完成') {
    return 'border-green-500 bg-green-500 text-white shadow-green-900/20'
  }
  return 'border-red-500 bg-red-500 text-white shadow-red-900/20'
})

const handleHome = async () => {
  if (isMovingHome.value) return
  isMovingHome.value = true
  isSetHome.value = '回零中'
  try {
    const res = await home()
    if (!res?.success) {
      isSetHome.value = '未回零'
      error('回零失败', res?.message ?? '')
      return
    }
    isSetHome.value = '回零完成'
    success('回零完成')
  } finally {
    isMovingHome.value = false
  }
}

const handleOutput0 = () => error('IO 接口待后端实现', '输出0 暂不可用')
const handleOutput1 = () => error('IO 接口待后端实现', '输出1 暂不可用')
const handleOutput2 = () => error('IO 接口待后端实现', '输出2 暂不可用')
const handleSkip = () => error('跳过', '跳过功能暂未实现')

onMounted(async () => {
  if (autoHomeOnStart.value && !ISARRIVEDHOME.value) {
    await handleHome()
  }
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      @click="handleOutput0"
      class="flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200 border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-power" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput1"
      class="flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200 border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-kejian" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput2"
      class="flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200 border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-Point" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleSkip"
      class="flex h-12 w-12 items-center justify-center rounded-full border border-(--app-border) bg-(--app-card-soft) text-xs font-medium text-(--app-text-secondary) shadow-sm transition-colors hover:bg-slate-100/90 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
      @keydown.enter.prevent
    >
      跳过
    </button>
    <button
      type="button"
      @click="handleHome"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-full border text-xs font-medium shadow-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        homeStatusClass
      ]"
      @keydown.enter.prevent
    >
      {{ isSetHome }}
    </button>
    <label class="flex items-center gap-1 text-xs text-(--app-text-secondary) select-none">
      <input
        v-model="autoHomeOnStart"
        type="checkbox"
        class="h-4 w-4 accent-sky-500"
      />
      启动自动回零
    </label>
  </div>
</template>
