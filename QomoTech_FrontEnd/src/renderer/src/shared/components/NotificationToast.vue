<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-14 z-70 flex flex-col gap-2.5">
      <TransitionGroup name="toast">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="
            toast-card pointer-events-auto w-90 overflow-hidden rounded-xl border
          "
        >
          <div class="relative z-1">
          <!-- ── 头部：图标 + 标题 + 关闭 ── -->
          <div class="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <SvgIcon
                :icon-name="iconDef(n.type).name"
                :class-name="iconDef(n.type).class"
              />
              <span class="text-sm font-semibold tracking-tight text-(--app-text-primary) truncate">
                {{ titleText(n.type) }}
              </span>
            </div>
            <button
              class="
                shrink-0 -mr-1 -mt-0.5 rounded-md p-1
                text-(--app-text-muted) transition
                hover:bg-black/6 dark:hover:bg-white/10
              "
              aria-label="关闭通知"
              @click="removeNotification(n.id)"
            >
              <SvgIcon icon-name="icon-guanbi" class-name="text-xs" />
            </button>
          </div>

          <!-- ── 内容 ── -->
          <div class="px-4 pb-2.5">
            <p class="text-[13px] font-semibold leading-snug text-(--app-text-primary)">
              {{ n.message }}
            </p>
            <p
              v-if="n.description"
              class="mt-1 text-xs leading-relaxed text-(--app-text-secondary)"
            >
              {{ n.description }}
            </p>
          </div>

          <!-- ── 时间戳 ── -->
          <div class="px-4 pb-3">
            <span class="text-[11px] tracking-wide text-(--app-text-muted)">
              {{ formatRelativeTime(n.timestamp) }}
            </span>
          </div>

          <!-- ── 底部进度条 ── -->
          <div
            v-if="n.duration > 0"
            class="h-1 w-full"
            :class="progressTrackClass(n.type)"
          >
            <div
              class="h-full transition-all duration-120 ease-linear"
              :class="progressBarClass(n.type)"
              :style="{ width: `${n.progress}%` }"
            />
          </div>

          </div><!-- /content-wrap -->
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import type { AddNotificationInput, NotificationItem } from '@/shared/types'

// ── 数据 ────────────────────────────────────────────

const notifications = ref<NotificationItem[]>([])

const DEFAULT_DURATION = 4500

// ── 全局秒级时钟（驱动时间戳实时更新） ────────────

const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  clearAll()
})

// ── 图标映射 ────────────────────────────────────────

type IconDef = { name: string; class: string }

function iconDef(type: string): IconDef {
  const map: Record<string, IconDef> = {
    success: { name: 'icon-gouxuan',   class: 'text-base text-emerald-600 dark:text-emerald-400' },
    error:   { name: 'icon-guanbi',    class: 'text-base text-red-600 dark:text-red-400' },
    warning: { name: 'icon-warning-filled', class: 'text-base text-amber-600 dark:text-amber-400' },
    info:    { name: 'icon-tishi',     class: 'text-base text-sky-600 dark:text-sky-400' },
  }
  return map[type] ?? map.info
}

function titleText(type: string): string {
  const map: Record<string, string> = {
    success: '操作成功',
    error:   '操作失败',
    warning: '警告',
    info:    '提示',
  }
  return map[type] ?? '提示'
}

function progressTrackClass(type: string): string {
  const map: Record<string, string> = {
    success: 'bg-emerald-500/15',
    error:   'bg-red-500/15',
    warning: 'bg-amber-500/15',
    info:    'bg-sky-500/15',
  }
  return map[type] ?? map.info
}

function progressBarClass(type: string): string {
  const map: Record<string, string> = {
    success: 'bg-emerald-500',
    error:   'bg-red-500',
    warning: 'bg-amber-500',
    info:    'bg-sky-500',
  }
  return map[type] ?? map.info
}

// ── 相对时间 ────────────────────────────────────────

function formatRelativeTime(ts: number): string {
  const diff = now.value - ts
  if (diff < 1_000) return '刚刚'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}秒前`
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}分钟前`
  const date = new Date(ts)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ── 计时器 ──────────────────────────────────────────

function startTimer(notification: NotificationItem): void {
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

// ── 增删 ────────────────────────────────────────────

function addNotification(input: AddNotificationInput): void {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
  const duration = input.duration ?? DEFAULT_DURATION
  const newNotification = reactive<NotificationItem>({
    id,
    type: input.type,
    message: input.message,
    description: input.description ?? '',
    duration,
    progress: 100,
    timestamp: Date.now(),
  })
  notifications.value.push(newNotification)
  if (newNotification.duration > 0) {
    startTimer(newNotification)
  }
}

function removeNotification(id: string): void {
  const idx = notifications.value.findIndex((item) => item.id === id)
  if (idx === -1) return
  const item = notifications.value[idx]
  if (item.timer) clearInterval(item.timer as ReturnType<typeof setInterval>)
  notifications.value.splice(idx, 1)
}

function clearAll(): void {
  for (const n of notifications.value) {
    if (n.timer) clearInterval(n.timer as ReturnType<typeof setInterval>)
  }
  notifications.value = []
}

defineExpose({ addNotification, removeNotification, clearAll })
</script>

<style scoped>
/* ═══ 磨砂玻璃基底 ═══ */

.toast-card {
  position: relative;
  --glass-opacity: 40%;
  background-color: color-mix(in srgb, var(--app-card) var(--glass-opacity), transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-color: color-mix(in srgb, var(--app-border) 30%, transparent);
  /* 顶部高光 + 底部投影 */
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 24%, transparent),
    0 4px 20px color-mix(in srgb, #000 8%, transparent);
  /* GPU 合成层：避免动画期间 blur 重算 */
  will-change: transform;
  transform: translateZ(0);
  /* 限制重绘边界，不让后代溢出触发父级重绘 */
  contain: layout style paint;
}
.dark .toast-card,
:root[data-theme='dark'] .toast-card {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent),
    0 4px 28px color-mix(in srgb, #000 50%, transparent),
    0 0 0 1px color-mix(in srgb, #fff 4%, transparent);
}

/* ═══ 入场 / 离场动画 ═══ */
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition: all 0.22s ease-in;
}
.toast-enter-from {
  transform: translateX(110%);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(110%);
  opacity: 0;
}
.toast-move {
  transition: transform 0.28s ease;
}
</style>
