<script setup lang="ts">
// WorkflowCanvas_Node.vue — 画布节点卡片（N8N 风格）
//
// 三种视觉样式，由节点蓝图的 category 自动决定：
//   trigger  → 紫色头部，无输入端口，流程起点
//   action   → 蓝/绿头部（motion/io），1输入 1输出
//   flow     → 橙色头部，1输入 多输出（条件/分支）
//
// 连接点布局：输入点在底部左侧，输出点在底部右侧（均在底部）
//
// 所有样式数据来自 constants/nodeStyles.ts，卡片只负责渲染。
import { Handle, Position } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { useWorkflowNode } from '../composables/useWorkflowNode'

const props = defineProps<NodeProps>()
const emit  = defineEmits<{ remove: [id: string] }>()

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
  handleOffset,
  onRemove
} = useWorkflowNode(props, (event, id) => emit(event, id))
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

    <!-- 输入点占位：底部左侧，保持卡片底部有足够空间 -->
    <!-- 实际 Handle 在底部区域渲染，见下方 -->

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

    <!-- ── 底部端口区（输入在左，输出在右，均在底部） ───────────── -->
    <div class="relative flex items-center border-t border-(--app-border) px-3 py-1.5">

      <!-- 输入端口标签（trigger 无输入） -->
      <span v-if="!isTrigger" class="text-[10px] text-(--app-text-muted)">输入</span>
      <span v-else class="text-[10px] text-(--app-text-muted) opacity-0">-</span>

      <!-- 多输出端口名称（居中） -->
      <div v-if="hasMultipleOutputs" class="flex flex-1 justify-around">
        <span
          v-for="port in outputs"
          :key="port.name"
          class="text-[10px] font-medium text-(--app-text-muted)"
        >
          {{ port.displayName }}
        </span>
      </div>
      <div v-else class="flex-1" />

      <!-- 输出端口标签 -->
      <span class="text-[10px] text-(--app-text-muted)">
        {{ hasMultipleOutputs ? '' : '输出' }}
      </span>
    </div>

    <!-- ── 输入连接点（底部左侧，trigger 无） ────────────────────── -->
    <Handle
      v-if="!isTrigger"
      id="main"
      type="target"
      :position="Position.Bottom"
      class="h-3! w-3! border-2! -bottom-1.5!"
      :style="{
        left: '25%',
        borderColor: style.headerBg,
        background: 'var(--app-card)'
      }"
    />

    <!-- ── 输出连接点（底部右侧：单输出；多输出：均匀分布右半区） ── -->
    <Handle
      v-if="!hasMultipleOutputs"
      id="main"
      type="source"
      :position="Position.Bottom"
      class="h-3! w-3! border-2! -bottom-1.5!"
      :style="{
        left: isTrigger ? '50%' : '75%',
        borderColor: style.headerBg,
        background: 'var(--app-card)'
      }"
    />
    <template v-else>
      <Handle
        v-for="(port, idx) in outputs"
        :key="port.name"
        :id="port.name"
        type="source"
        :position="Position.Bottom"
        class="h-3! w-3! border-2! -bottom-1.5!"
        :style="{
          left: `calc(50% + ${handleOffset(outputs.length, idx)})`,
          borderColor: style.headerBg,
          background: 'var(--app-card)'
        }"
      />
    </template>

  </div>
</template>
