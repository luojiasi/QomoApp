<script setup lang="ts">
import { ref } from 'vue'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'

type AuxiliaryTabId =
  | 'axisCenterCalib'
  | 'quickDot'
  | 'quickFocus'
  | 'quickConcentric'
  | 'userCustom'

const isPanelExpanded = ref(false)

const activeTab = ref<AuxiliaryTabId>('axisCenterCalib')

const tabs: { id: AuxiliaryTabId; label: string }[] = [
  { id: 'axisCenterCalib', label: '五轴校准' },
  { id: 'quickDot', label: '快速打点' },
  { id: 'quickFocus', label: '快速找焦' },
  { id: 'quickConcentric', label: '快速调同' },
  { id: 'userCustom', label: '自定功能' },
]

const sectionPlaceholders: Record<AuxiliaryTabId, string> = {
  axisCenterCalib: '五轴中心校准相关控制与流程将放置于此。',
  quickDot: '快速打点相关参数与操作将放置于此。',
  quickFocus: '快速找焦点相关向导与控件将放置于此。',
  quickConcentric: '快速调同心相关步骤将放置于此。',
  userCustom: '用户可配置的自定义功能将放置于此。',
}
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isPanelExpanded"
      title="辅助功能区"
    />
    <div v-show="isPanelExpanded" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
        <div class="flex flex-col-5 gap-2">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
            :class="
              activeTab === item.id
                ? 'border-sky-500/70 bg-sky-500/10 text-(--app-text-primary)'
                : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-primary) hover:border-sky-500/35 hover:bg-(--app-card)'
            "
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-1 text-xs font-medium text-(--app-text-primary)">
          {{ tabs.find((t) => t.id === activeTab)?.label }}
        </p>
        <p class="text-xs leading-relaxed text-(--app-text-muted)">
          {{ sectionPlaceholders[activeTab] }}
        </p>
      </div>
    </div>
  </div>
</template>
