<script setup lang="ts">
import { onMounted } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { useIoOutputs } from '@/modules/motion/composables/controller/useIoOutputs'
import { useHome } from '@/modules/motion/composables/motion/useHome'

const { ioOutputs, handleIoOutputToggle } = useIoOutputs()
const { isSetHome, autoHomeOnStart, homeStatusClass, handleHome, initAutoHome } = useHome()

onMounted(async () => {
  await initAutoHome()
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      @click="handleIoOutputToggle(0)"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOutputs[0]
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-power" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleIoOutputToggle(1)"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOutputs[1]
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-kejian" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleIoOutputToggle(2)"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOutputs[2]
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-Point" class-name="text-2xl" />
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
