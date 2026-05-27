<script setup lang="ts">
// WorkflowCanvas_Node.vue — 画布节点卡片（N8N 风格）
//
// 三种视觉样式，由节点蓝图的 category 自动决定：
//   trigger  → 紫色头部，无输入端口，流程起点
//   action   → 蓝/绿头部（motion/io），1输入 1输出
//   flow     → 橙色头部，1输入 多输出（条件/分支）
//
// 连接点布局：底部左右各半区，输入/输出文字与连接点各自居中对齐
//
// 所有样式数据来自 constants/nodeStyles.ts，卡片只负责渲染。
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { useWorkflowNode } from '../composables/useWorkflowNode'

const props = defineProps<NodeProps>()

const {
  NODE_WIDTH,
  style,
  label,
  description,
  displayName,
  icon,
  isTrigger,
  outputs,
  hasMultipleOutputs,
  onRemove
} = useWorkflowNode(props)
</script>

<template>
  <div
    class="relative flex flex-col overflow-visible rounded-xl border border-(--app-border) bg-(--app-card) text-[13px] shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-all duration-150 select-none"
    :style="{
      width: NODE_WIDTH + 'px',
      boxShadow: props.selected
        ? `0 0 0 2px ${style.ringColor}, 0 4px 16px rgba(0,0,0,0.22)`
        : '0 2px 12px rgba(0,0,0,0.18)'
    }"
  >

    <!-- ── 头部：彩色背景 + 图标 + 节点类型名 ─────────────────── -->
    <div
      class="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
      :style="{ background: style.headerBg }"
    >
      <span class="text-base leading-none" :style="{ color: style.headerText }">
        {{ icon }}
      </span>
      <span
        class="flex-1 truncate text-[11px] font-semibold tracking-wide"
        :style="{ color: style.headerText }"
      >
        {{ displayName }}
      </span>
      <button
        class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-white/10 text-sm leading-none transition-colors hover:bg-white/25"
        :style="{ color: style.headerText }"
        title="删除节点"
        @click.stop="onRemove"
      >×</button>
    </div>

    <!-- ── 正文：用户自定义名称 + 备注 ──────────────────────────── -->
    <div class="px-3 pb-2.5 pt-2">
      <div class="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-(--app-text-primary)">
        {{ label }}
      </div>
      <div
        v-if="description"
        class="mt-0.5 text-[11px] leading-snug text-(--app-text-muted)"
      >
        {{ description }}
      </div>
    </div>

    <!-- ── 底部端口区：左半输入 / 右半输出，连接点与文字居中对齐 ── -->
    <div class="grid grid-cols-2 border-t border-(--app-border)">

      <!-- 左半：输入 -->
      <div
        class="relative flex min-h-9 flex-col items-center justify-center border-r border-(--app-border) px-1 py-1.5 pb-3"
      >
        <span
          v-if="!isTrigger"
          class="text-[10px] text-(--app-text-muted)"
        >输入</span>
        <Handle
          v-if="!isTrigger"
          id="main"
          type="target"
          :position="Position.Bottom"
          class="port-handle"
          :style="{
            borderColor: style.headerBg,
            background: 'var(--app-card)'
          }"
        />
      </div>

      <!-- 右半：输出（单端口或多端口；每列自带 pb-3，连接点贴底边） -->
      <div
        class="flex min-h-9"
        :class="hasMultipleOutputs ? '' : 'relative flex-col items-center justify-center px-1 py-1.5 pb-3'"
      >
        <template v-if="hasMultipleOutputs">
          <div
            v-for="port in outputs"
            :key="port.name"
            class="relative flex flex-1 flex-col items-center justify-center px-1 py-1.5 pb-3"
          >
            <span class="text-[10px] font-medium text-(--app-text-muted)">
              {{ port.displayName }}
            </span>
            <Handle
              :id="port.name"
              type="source"
              :position="Position.Bottom"
              class="port-handle"
              :style="{
                borderColor: style.headerBg,
                background: 'var(--app-card)'
              }"
            />
          </div>
        </template>
        <template v-else>
          <span class="text-[10px] text-(--app-text-muted)">输出</span>
          <Handle
            id="main"
            type="source"
            :position="Position.Bottom"
            class="port-handle"
            :style="{
              borderColor: style.headerBg,
              background: 'var(--app-card)'
            }"
          />
        </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 连接点：相对各自半区水平居中，略伸出卡片底边 */
.port-handle {
  position: absolute !important;
  bottom: 0 !important;
  left: 50% !important;
  height: 12px !important;
  width: 12px !important;
  border-width: 2px !important;
  transform: translate(-50%, 50%) !important;
}
</style>
