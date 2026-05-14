<script setup lang="ts">
defineProps<{
  programRunning: boolean
  programPaused: boolean
  programTaskCount: number
}>()

const emit = defineEmits<{
  (event: 'run'): void
  (event: 'pauseToggle'): void
  (event: 'resetAlarms'): void
  (event: 'estop'): void
  (event: 'skipTask'): void
}>()

const btnBase = 'z-50 h-10 w-16 rounded-2xl text-lg font-bold text-white shadow-xl transition-all duration-200 hover:scale-110 hover:border-2 active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400'

function onKeydownEnter(e: KeyboardEvent): void {
  e.preventDefault()
}
</script>

<template>
  <div class="flex gap-3">
    <button
      :class="[btnBase, 'bg-green-600 hover:border-green-300 hover:bg-green-700']"
      :disabled="programRunning"
      @keydown.enter="onKeydownEnter"
      @click="emit('run')"
    >
      运行
    </button>
    <button
      :class="[btnBase, 'bg-yellow-600 hover:border-yellow-300 hover:bg-yellow-700']"
      :disabled="!programRunning"
      @keydown.enter="onKeydownEnter"
      @click="emit('pauseToggle')"
    >
      {{ programPaused ? '继续' : '暂停' }}
    </button>
    <button
      :class="[btnBase, 'bg-blue-700 hover:border-blue-300 hover:bg-blue-800']"
      @keydown.enter="onKeydownEnter"
      @click="emit('resetAlarms')"
    >
      复位
    </button>
    <button
      :class="[btnBase, 'bg-red-700 hover:border-red-300 hover:bg-red-800']"
      @keydown.enter="onKeydownEnter"
      @click="emit('estop')"
    >
      急停
    </button>
    <button
      v-if="programTaskCount >= 2"
      :class="[btnBase, 'bg-orange-600 hover:border-orange-300 hover:bg-orange-700']"
      :disabled="!programRunning"
      @keydown.enter="onKeydownEnter"
      @click="emit('skipTask')"
    >
      跳过
    </button>
  </div>
</template>
