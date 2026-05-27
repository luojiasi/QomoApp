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
  label, description,
  displayName, icon,
  isTrigger,
  outputs, hasMultipleOutputs,
  inputLabel,
  disabled,
  statusIcon,
  statusBorderColor,
  statusAnimationClass,
  nodeBorderWidth,
  statusText,
  allInputs,
  hasMultipleInputs,
  onRemove,
  onToggleDisable,
  onRun
} = useWorkflowNode(props)

</script>

<template>
  <div class="node-outer select-none">

    <!-- ── 操作栏（选中节点时显示在节点上方） ────────────────── -->
    <div v-show="props.selected" class="node-action-bar">
      <button
        class="action-btn"
        title="运行此节点"
        @click.stop="onRun"
      >▶</button>
      <button
        class="action-btn"
        :title="disabled ? '启用节点' : '禁用节点'"
        @click.stop="onToggleDisable"
      >⊘</button>
      <button
        class="action-btn action-btn--danger"
        title="删除节点"
        @click.stop="onRemove"
      >×</button>
    </div>

    <!-- ── 节点卡片 ──────────────────────────────────────────── -->
    <div
      class="node-card relative flex flex-col overflow-visible rounded-xl border transition-all duration-150"
      :class="[
        disabled ? 'border-(--app-border) bg-(--app-card-soft)' : 'border-(--app-border) bg-(--app-card)',
        statusAnimationClass
      ]"
      :style="{
        width: NODE_WIDTH + 'px',
        opacity: disabled ? 0.45 : 1,
        borderColor: statusBorderColor || (disabled ? undefined : 'var(--app-border)'),
        borderWidth: statusBorderColor ? nodeBorderWidth + 'px' : undefined,
        boxShadow: props.selected
          ? `0 0 0 2px ${style.ringColor}, 0 4px 16px rgba(0,0,0,0.22)`
          : '0 2px 12px rgba(0,0,0,0.18)'
      }"
    >

      <!-- 头部 -->
      <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
        :style="{ background: disabled ? '#4b5563' : style.headerBg }"
      >
        <span
          class="text-base leading-none"
          :style="{ color: disabled ? '#9ca3af' : style.headerText }"
        >{{ icon }}</span>
        <span
          class="flex-1 truncate text-[11px] font-semibold tracking-wide"
          :style="{ color: disabled ? '#9ca3af' : style.headerText }"
        >{{ displayName }}</span>
        <span
          v-if="statusText"
          class="status-indicator shrink-0 text-xs font-bold"
          :style="{ color: statusBorderColor }"
        >{{ statusText }}</span>
        <span
          v-else-if="statusIcon"
          class="status-indicator shrink-0 text-xs font-bold"
          :style="{ color: statusBorderColor }"
        >{{ statusIcon }}</span>
      </div>

      <!-- 正文 -->
      <div class="px-3 pb-2.5 pt-2">
        <div class="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-(--app-text-primary)">
          {{ label }}
        </div>
        <div
          v-if="description"
          class="mt-0.5 text-[11px] leading-snug text-(--app-text-muted)"
        >{{ description }}</div>
      </div>

      <!-- 底部端口区 -->
      <div class="grid grid-cols-2 border-t" :class="disabled ? 'border-gray-500/30' : 'border-(--app-border)'">
        <!-- 输入端口：单输入 / 多输入分栏 -->
        <div
          class="flex min-h-9 border-r"
          :class="disabled ? 'border-gray-500/30' : 'border-(--app-border)'"
        >
          <template v-if="!isTrigger">
            <div
              v-if="!hasMultipleInputs"
              class="relative flex flex-1 flex-col items-center justify-center px-1 py-1.5 pb-3"
            >
              <span class="text-[10px] text-(--app-text-muted)">{{ inputLabel }}</span>
              <Handle
                id="main"
                type="target"
                :position="Position.Bottom"
                class="port-handle"
                :style="{ borderColor: disabled ? '#4b5563' : style.headerBg, background: 'var(--app-card)' }"
              />
            </div>
            <div
              v-for="(port, idx) in allInputs"
              v-else
              :key="port.name"
              class="relative flex flex-1 flex-col items-center justify-center px-1 py-1.5 pb-3"
              :class="{ 'border-r': idx < allInputs.length - 1 }"
              :style="{ borderColor: disabled ? '#4b5563' : 'var(--app-border)' }"
            >
              <span class="text-[10px] font-medium text-(--app-text-muted)">{{ port.displayName }}</span>
              <Handle
                :id="port.name"
                type="target"
                :position="Position.Bottom"
                class="port-handle"
                :style="{ borderColor: disabled ? '#4b5563' : style.headerBg, background: 'var(--app-card)' }"
              />
            </div>
          </template>
        </div>
        <div
          class="flex min-h-9"
          :class="hasMultipleOutputs ? '' : 'relative flex-col items-center justify-center px-1 py-1.5 pb-3'"
        >
          <template v-if="hasMultipleOutputs">
            <div v-for="port in outputs" :key="port.name" class="relative flex flex-1 flex-col items-center justify-center px-1 py-1.5 pb-3">
              <span class="text-[10px] font-medium text-(--app-text-muted)">{{ port.displayName }}</span>
              <Handle :id="port.name" type="source" :position="Position.Bottom" class="port-handle"
                :style="{ borderColor: disabled ? '#4b5563' : style.headerBg, background: 'var(--app-card)' }" />
            </div>
          </template>
          <template v-else>
            <span class="text-[10px] text-(--app-text-muted)">{{ outputs[0]?.displayName }}</span>
            <Handle id="main" type="source" :position="Position.Bottom" class="port-handle"
              :style="{ borderColor: disabled ? '#4b5563' : style.headerBg, background: 'var(--app-card)' }" />
          </template>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.node-outer {
  position: relative;
}

/* ── 悬浮操作栏 ──────────────────────────────────────────── */
.node-action-bar {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  padding: 2px;
  border-radius: 8px;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 20;
  white-space: nowrap;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s;
}

.action-btn:hover {
  background: var(--app-card-soft);
  color: var(--app-text-primary);
}

.action-btn--danger:hover {
  background: rgba(220, 38, 38, 0.12);
  color: #ef4444;
}

/* ── 节点卡片 ────────────────────────────────────────────── */
.node-card {
  transition: opacity 0.2s;
}

/* ── 连接点 ───────────────────────────────────────────────── */
.port-handle {
  position: absolute !important;
  bottom: 0 !important;
  left: 50% !important;
  height: 12px !important;
  width: 12px !important;
  border-width: 2px !important;
  transform: translate(-50%, 50%) !important;
}

/* ── 执行状态指示器 ────────────────────────────────────────── */
.status-indicator {
  min-width: 16px;
  text-align: center;
  line-height: 1;
}

/* ── 运行中闪烁动画 ────────────────────────────────────────── */
.status-running {
  animation: status-flash 0.8s ease-in-out infinite;
}

@keyframes status-flash {
  0%, 100% { border-color: #22c55e; }
  50%      { border-color: rgba(34, 197, 94, 0.2); }
}
</style>
