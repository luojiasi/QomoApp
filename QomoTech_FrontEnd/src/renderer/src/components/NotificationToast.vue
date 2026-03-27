<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[70] space-y-3">
      <TransitionGroup name="toast" tag="div" class="space-y-3">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="shadow-retro animate-slide-in-right pointer-events-auto min-w-80 max-w-96 rounded-xl border-4"
          :class="getNotificationClass(notification.type)"
        >
          <!-- 头部 -->
          <div
            class="m-1 flex items-center justify-between rounded-t-lg rounded-b-lg border-b-4 border-r-4 border-l border-t p-3"
            :class="getHeaderClass(notification.type)"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg">
                {{ getIcon(notification.type) }}
              </span>
              <span class="text-sm font-bold text-white">
                {{ getTitle(notification.type) }}
              </span>
            </div>
            <button
              class="shadow-retro-small rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black hover:bg-red-100"
              @click="removeNotification(notification.id)"
            >
              ✕
            </button>
          </div>
          <!-- 内容 -->
          <div
            class="m-1 rounded-t-lg rounded-b-lg border-b-4 border-r-4 border-l border-t border-gray-800 bg-gray-200 p-4"
          >
            <div class="text-lg font-bold text-gray-800">
              {{ notification.message }}
            </div>
            <div v-if="notification.description" class="mt-1 text-sm text-gray-600">
              {{ notification.description }}
            </div>
          </div>
          <!-- 进度条 -->
          <div v-if="notification.duration > 0" class="h-1">
            <div
              class="h-full transition-all ease-linear"
              :class="getProgressClass(notification.type)"
              :style="{ width: `${notification.progress}%` }"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import type { AddNotificationInput, NotificationItem } from '../types/notification'

const notifications = ref<NotificationItem[]>([])

const getIcon = (type: string) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[type as keyof typeof icons] || 'ℹ️'
}
const getTitle = (type: string) => {
  const titles = {
    success: '成功（Success）',
    error: '错误（Error）',
    warning: '警告（Warning）',
    info: '信息（Info）'
  }
  return titles[type as keyof typeof titles] || 'Info'
}

const getHeaderClass = (type: string) => {
  const classes = {
    success: 'border-green-800 bg-green-500',
    error: 'border-red-800 bg-red-500',
    warning: 'border-yellow-800 bg-yellow-500',
    info: 'border-blue-800 bg-blue-500'
  }
  return classes[type as keyof typeof classes] || 'bg-blue-500'
}

const getNotificationClass = (type: string) => {
  const classes = {
    success: 'border-green-500',
    error: 'border-red-500',
    warning: 'border-yellow-500',
    info: 'border-blue-500'
  }
  return classes[type as keyof typeof classes] || 'border-blue-500'
}
const getProgressClass = (type: string) => {
  const classes = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  }
  return classes[type as keyof typeof classes] || 'bg-blue-500'
}

const startTimer = (notification: NotificationItem) => {
  const startTime = Date.now()
  const duration = notification.duration
  notification.timer = setInterval(() => {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, duration - elapsed)
    notification.progress = (remaining / duration) * 100
    if (remaining <= 0) {
      clearInterval(notification.timer as ReturnType<typeof setInterval>)
      removeNotification(notification.id)
    }
  }, 100)
}

const removeNotification = (id: string) => {
  const index = notifications.value.findIndex((item) => item.id === id)
  if (index !== -1) {
    const notification = notifications.value[index]
    if (notification.timer) {
      clearInterval(notification.timer as ReturnType<typeof setInterval>)
    }
    notifications.value.splice(index, 1)
  }
}

const clearAll = () => {
  notifications.value.forEach((notification) => {
    if (notification.timer) {
      clearInterval(notification.timer as ReturnType<typeof setInterval>)
    }
  })
  notifications.value = []
}

const DEFAULT_DURATION = 4500

const addNotification = (input: AddNotificationInput) => {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
  const duration = input.duration ?? DEFAULT_DURATION
  const newNotification = reactive<NotificationItem>({
    id,
    type: input.type,
    message: input.message,
    description: input.description ?? '',
    duration,
    progress: 100
  })
  notifications.value.push(newNotification)
  if (newNotification.duration > 0) {
    startTimer(newNotification)
  }
}

defineExpose({
  addNotification,
  removeNotification,
  clearAll
})

onMounted(() => {
  clearAll()
})
</script>

<style scoped>
/* 动画效果 */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
</style>
