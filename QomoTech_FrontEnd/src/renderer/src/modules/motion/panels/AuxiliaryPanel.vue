<script setup lang="ts">
import ControlPanelBase from '../components/ControlPanelBase.vue'
import TabBar from '@/shared/components/TabBar.vue'
import AxisCenterCalibPanel from '../components/AxisCenterCalibPanel.vue'
import QuickFocusPanel from '../components/QuickFocusPanel.vue'
import QuickDotPanel from '../components/QuickDotPanel.vue'
import QuickConcentricPanel from '../components/QuickConcentricPanel.vue'
import UserCustomPanel from '../components/UserCustomPanel.vue'
import QuickMoveToPositionPanel from '../components/QuickMoveToPositionPanel.vue'
import { useAuxiliaryPanelLogic } from './AuxiliaryPanel.logic'

const { isPanelExpanded, activeTab, tabs } = useAuxiliaryPanelLogic()
</script>

<template>
  <ControlPanelBase
    v-model:expanded="isPanelExpanded"
    title="辅助功能区"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <template #default>
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
        <TabBar v-model="activeTab" :tabs="tabs" />
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <AxisCenterCalibPanel v-if="activeTab === 'axisCenterCalib'" />
        <QuickFocusPanel v-if="activeTab === 'quickFocus'" />
        <QuickDotPanel v-if="activeTab === 'quickDot'" />
        <QuickConcentricPanel v-if="activeTab === 'quickConcentric'" />
        <UserCustomPanel v-if="activeTab === 'userCustom'" />
        <QuickMoveToPositionPanel v-if="activeTab === 'quickMoveToPosition'" />
      </div>
    </template>
  </ControlPanelBase>
</template>
