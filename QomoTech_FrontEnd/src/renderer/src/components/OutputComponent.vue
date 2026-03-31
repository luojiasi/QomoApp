<script setup lang="ts">
import { ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { setMotionIoOutput } from '../utils/motionApi'
import { apiCall } from '../utils/toBackendApiCall'

const outPut = ref({
  output0: false,
  output1: false,
  output2: false
})

const handleSkip = async () => {
  const result = await apiCall('hardware/status', 'GET')
  if (!result?.success) return
  const state = result.data?.state
  if (!state) return

  const ioMap = Array.isArray(state.motion_io_map) ? state.motion_io_map : []
  console.log(ioMap)
  outPut.value = {
    output0: Boolean(ioMap[0]?.digitalOut),
    output1: Boolean(ioMap[1]?.digitalOut),
    output2: Boolean(ioMap[2]?.digitalOut)
  }
}

const handleOutput0 = async () => {
  const result = await setMotionIoOutput(0, !outPut.value.output0)
  if (!result?.success) return
  outPut.value.output0 = !outPut.value.output0
}
const handleOutput1 = async () => {
  const result = await setMotionIoOutput(1, !outPut.value.output1)
  if (!result?.success) return
  outPut.value.output1 = !outPut.value.output1
}
const handleOutput2 = async () => {
  const result = await setMotionIoOutput(2, !outPut.value.output2)
  if (!result?.success) return
  outPut.value.output2 = !outPut.value.output2
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      @click="handleOutput0"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        outPut.output0
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-power" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput1"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        outPut.output1
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-switch" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput2"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        outPut.output2
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
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
      @click="handleSkip"
      class="flex h-12 w-12 items-center justify-center rounded-full border border-(--app-border) bg-(--app-card-soft) text-xs font-medium text-(--app-text-secondary) shadow-sm transition-colors hover:bg-slate-100/90 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
      @keydown.enter.prevent
    >
      回零
    </button>
  </div>
</template>
