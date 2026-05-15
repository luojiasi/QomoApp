<script setup lang="ts">
import { ref } from 'vue'
import ControlPanelBase from '../components/ControlPanelBase.vue'
import OutputComponent from './OutputComponent.vue'
import { useDriverControlPanelLogic } from './DriverControlPanel.logic'

const emit = defineEmits<{ (e: 'open-right-panel', target: string): void }>()

const isDriverPanelExpanded = ref(true)
const { axisMposLabels } = useDriverControlPanelLogic()

const ioMapForChild = ref<Array<{ digitalIn: boolean; digitalOut: boolean }>>([])
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isDriverPanelExpanded"
    title="控制驱动器面板"
    action-target="ControllerSettings"
    content-always-visible
    :class="isDriverPanelExpanded ? 'min-h-[min(250px,42vh)]' : ''"
    @open-right-panel="(target) => emit('open-right-panel', target)"
  >
    <template #default>
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div class="grid grid-cols-5 gap-2">
          <label
            v-for="item in axisMposLabels"
            :key="item.name"
            class="flex min-w-0 flex-col gap-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-2 py-2"
          >
            <span class="text-[11px] text-(--app-text-muted)">{{ item.name }} 轴</span>
            <span class="truncate text-xs font-medium text-(--app-text-primary)">{{ item.value }}</span>
          </label>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <OutputComponent :motion-io-map="ioMapForChild" />
      </div>
    </template>
  </ControlPanelBase>
</template>
