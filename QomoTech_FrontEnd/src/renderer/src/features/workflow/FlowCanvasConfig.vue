<script setup lang="ts">
import { useSelfProcessStore } from '../../stores/selfProcessStores'

const store = useSelfProcessStore()

// ──── MiniMap 位置选项 ─────────────────────────────────────
const miniMapPositionOptions = [
  { label: '左上', value: 'top-left' },
  { label: '右上', value: 'top-right' },
  { label: '左下', value: 'bottom-left' },
  { label: '右下', value: 'bottom-right' }
] as const
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto p-4 text-sm">
    <!-- 断点测试 -->
    <section class="mb-5">
      <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">断点测试</h4>
      <div class="rounded-lg border border-(--app-border) p-3">
        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-[12px] text-(--app-text-secondary)">启用断点测试模式</span>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
            :class="store.breakpointEnabled ? 'bg-blue-600' : 'bg-(--app-border)'"
            @click="store.setBreakpointEnabled(!store.breakpointEnabled)"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
              :class="store.breakpointEnabled ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </label>
        <p class="mt-2 text-[11px] leading-relaxed text-(--app-text-muted)">
          开启后，点击画布上节点右下角的红色圆点来设置/取消断点。运行流程时遇到断点会暂停，点击"继续"按钮恢复执行。
        </p>
        <div v-if="store.breakpointPaused" class="mt-3 flex items-center gap-2">
          <span class="text-[11px] text-yellow-600">⏸ 已暂停</span>
          <button
            class="cursor-pointer rounded-md bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
            @click="store.resumeFromBreakpoint()"
          >
            ▶ 继续执行
          </button>
        </div>
      </div>
    </section>

    <!-- 网格对齐 -->
    <section class="mb-5">
      <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">网格对齐</h4>
      <div class="rounded-lg border border-(--app-border) p-3 space-y-3">
        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-[12px] text-(--app-text-secondary)">吸附到网格</span>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
            :class="store.snapToGrid ? 'bg-blue-600' : 'bg-(--app-border)'"
            @click="store.snapToGrid = !store.snapToGrid"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
              :class="store.snapToGrid ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </label>
        <div class="flex items-center gap-2">
          <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">网格大小</span>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            v-model.number="store.snapGridSize"
            class="flex-1 h-1 cursor-pointer"
          />
          <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ store.snapGridSize }}px</span>
        </div>
      </div>
    </section>

    <!-- 背景网格 -->
    <section class="mb-5">
      <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">背景网格</h4>
      <div class="rounded-lg border border-(--app-border) p-3 space-y-3">
        <div class="flex items-center gap-2">
          <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">间隔</span>
          <input
            type="range"
            min="10"
            max="60"
            step="5"
            v-model.number="store.bgGap"
            class="flex-1 h-1 cursor-pointer"
          />
          <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ store.bgGap }}px</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">点大小</span>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            v-model.number="store.bgSize"
            class="flex-1 h-1 cursor-pointer"
          />
          <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ store.bgSize }}px</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">颜色</span>
          <input
            type="color"
            v-model="store.bgColor"
            class="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
          <span class="text-[11px] text-(--app-text-muted)">{{ store.bgColor }}</span>
        </div>
      </div>
    </section>

    <!-- 小地图 -->
    <section class="mb-5">
      <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">小地图</h4>
      <div class="rounded-lg border border-(--app-border) p-3 space-y-3">
        <label class="flex cursor-pointer items-center justify-between">
          <span class="text-[12px] text-(--app-text-secondary)">显示小地图</span>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
            :class="store.showMiniMap ? 'bg-blue-600' : 'bg-(--app-border)'"
            @click="store.showMiniMap = !store.showMiniMap"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
              :class="store.showMiniMap ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </label>
        <template v-if="store.showMiniMap">
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">宽度</span>
            <input
              type="range"
              min="100"
              max="300"
              step="10"
              v-model.number="store.miniMapWidth"
              class="flex-1 h-1 cursor-pointer"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ store.miniMapWidth }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">高度</span>
            <input
              type="range"
              min="60"
              max="200"
              step="10"
              v-model.number="store.miniMapHeight"
              class="flex-1 h-1 cursor-pointer"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ store.miniMapHeight }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">位置</span>
            <select
              v-model="store.miniMapPosition"
              class="flex-1 cursor-pointer rounded border border-(--app-border) bg-(--app-card) px-2 py-1 text-[11px] text-(--app-text-primary)"
            >
              <option
                v-for="opt in miniMapPositionOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
