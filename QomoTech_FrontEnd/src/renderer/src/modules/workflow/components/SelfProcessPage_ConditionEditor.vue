<script setup lang="ts">
// SelfProcessPage_ConditionEditor.vue — IF 节点条件列表编辑器
//
// 每行：输入端口选择 → 字段名 → 运算符 → 比较值 → 删除
// 字段和值支持 $ 表达式引用上游数据，可通过数据树点击插入
// 底部 + 添加条件按钮

import { computed, ref } from 'vue'
import AppSelect from '../UI/AppSelect.vue'
import AppInput from '../UI/AppInput.vue'
import AppButton from '../UI/AppButton.vue'
import { CONDITION_OPERATORS } from '../constants/conditionOperators'
import { TreeItem } from './SelfProcessPage_NodeSettings.vue'
import type { IfCondition } from '../types/workflow'

const props = defineProps<{
  conditions: IfCondition[] | unknown
  inputNames: { name: string; displayName: string }[]
  upstreamFields?: Record<string, string[]>
  upstreamOutputData?: Record<string, Record<string, unknown>>
  mode?: string
}>()

const emit = defineEmits<{ 'update:conditions': [IfCondition[]]; 'update:mode': [string] }>()

const list = computed(() =>
  Array.isArray(props.conditions) ? (props.conditions as IfCondition[]) : []
)

const inputOptions = computed(() =>
  props.inputNames.map(n => ({ label: n.displayName, value: n.name }))
)

// 数据树弹出状态: { rowIndex, target: 'field' | 'value' } | null
const treeTarget = ref<{ row: number; target: 'field' | 'value' } | null>(null)

function openTree(row: number, target: 'field' | 'value'): void {
  treeTarget.value = treeTarget.value?.row === row && treeTarget.value?.target === target ? null : { row, target }
}

function onSelectPath(path: string): void {
  if (!treeTarget.value) return
  const expr = '$' + path
  if (treeTarget.value.target === 'field') {
    patch(treeTarget.value.row, { field: expr })
  } else {
    patch(treeTarget.value.row, { value: expr })
  }
  treeTarget.value = null
}

const hasUpstreamData = computed(() => {
  const d = props.upstreamOutputData
  return d && Object.keys(d).length > 0
})

function firstInputName(): string {
  return props.inputNames[0]?.name ?? 'main'
}

function add(): void {
  const next = [...list.value, {
    inputName: firstInputName(),
    field: '',
    operator: 'eq' as const,
    value: ''
  }]
  emit('update:conditions', next)
}

function remove(index: number): void {
  const next = [...list.value]
  next.splice(index, 1)
  emit('update:conditions', next)
}

function patch(index: number, p: Partial<IfCondition>): void {
  const next = [...list.value]
  next[index] = { ...next[index], ...p }
  emit('update:conditions', next)
}

/** 支持 $ 表达式：以 $ 开头则保留字符串，否则数字类型转 number */
function castValue(raw: string): string | number {
  if (raw.startsWith('$')) return raw
  const n = Number(raw)
  return raw !== '' && !isNaN(n) ? n : raw
}

/** 获取指定输入端口的可用字段名列表 */
function fieldsFor(portName: string): string[] {
  return props.upstreamFields?.[portName] ?? []
}

</script>

<template>
  <div class="space-y-2">
    <!-- AND / OR 切换 -->
    <div v-if="list.length > 0" class="flex items-center gap-1">
      <span class="text-[10px] text-(--app-text-muted) shrink-0">条件关系:</span>
      <button
        class="cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
        :class="mode === 'AND'
          ? 'bg-(--app-text-primary) text-(--app-bg)'
          : 'border border-(--app-border) text-(--app-text-muted) hover:text-(--app-text-primary)'"
        @click="emit('update:mode', 'AND')"
      >AND</button>
      <button
        class="cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
        :class="mode === 'OR'
          ? 'bg-(--app-text-primary) text-(--app-bg)'
          : 'border border-(--app-border) text-(--app-text-muted) hover:text-(--app-text-primary)'"
        @click="emit('update:mode', 'OR')"
      >OR</button>
    </div>

    <!-- 条件行 -->
    <div
      v-for="(cond, idx) in list"
      :key="idx"
      class="rounded-lg border border-(--app-border) bg-(--app-card-soft) p-2"
    >
      <div class="flex items-start gap-1">
        <!-- 输入端口 -->
        <AppSelect
          :model-value="cond.inputName"
          :options="inputOptions"
          class="w-[72px] shrink-0"
          @update:model-value="patch(idx, { inputName: $event as string })"
        />

        <!-- 字段名 -->
        <AppInput
          :model-value="cond.field"
          placeholder="字段"
          class="w-[72px] shrink-0"
          @update:model-value="patch(idx, { field: $event as string })"
        />
        <button
          class="cursor-pointer shrink-0 rounded px-1 py-1 text-[10px] text-(--app-text-muted) hover:text-(--app-text-primary) hover:bg-black/5 transition-colors"
          title="从上游数据树选择字段"
          @click="openTree(idx, 'field')"
        >🌲</button>

        <!-- 运算符 -->
        <AppSelect
          :model-value="cond.operator"
          :options="CONDITION_OPERATORS as { label: string; value: string | number }[]"
          class="w-[110px] shrink-0"
          @update:model-value="patch(idx, { operator: ($event as string) as IfCondition['operator'] })"
        />

        <!-- 比较值 -->
        <AppInput
          :model-value="String(cond.value)"
          placeholder="值"
          class="min-w-0 flex-1"
          @update:model-value="patch(idx, { value: castValue($event as string) })"
        />
        <button
          class="cursor-pointer shrink-0 rounded px-1 py-1 text-[10px] text-(--app-text-muted) hover:text-(--app-text-primary) hover:bg-black/5 transition-colors"
          title="从上游数据树选择值"
          @click="openTree(idx, 'value')"
        >🌲</button>

        <!-- 删除 -->
        <AppButton
          variant="danger"
          size="sm"
          title="删除此条件"
          @click="remove(idx)"
        >
          &times;
        </AppButton>
      </div>

      <!-- 数据树弹出 -->
      <div
        v-if="treeTarget && treeTarget.row === idx"
        class="mt-1.5 rounded-lg border border-(--app-border) bg-(--app-card) py-1"
      >
        <div class="flex items-center justify-between px-2 pb-1">
          <span class="text-[10px] text-(--app-text-muted)">
            选择上游数据 → 填入{{ treeTarget.target === 'field' ? '字段' : '值' }}
          </span>
          <button
            class="cursor-pointer text-[11px] text-(--app-text-muted) hover:text-(--app-text-primary)"
            @click="treeTarget = null"
          >✕</button>
        </div>
        <div v-if="hasUpstreamData" class="max-h-[160px] wf-scroll-y">
          <template v-for="(val, key) in upstreamOutputData" :key="key">
            <TreeItem
              :name="key"
              :value="val"
              :path="key"
              :depth="0"
              @select="onSelectPath"
            />
          </template>
        </div>
        <div v-else class="px-2 pb-2">
          <p class="text-[10px] text-(--app-text-muted)">
            请先运行一次上游节点，执行后可查看数据树
          </p>
        </div>
      </div>

      <!-- 上游字段提示 -->
      <div
        v-if="fieldsFor(cond.inputName).length > 0"
        class="mt-1.5 flex items-center gap-1 flex-wrap pl-[74px]"
      >
        <span class="text-[10px] text-(--app-text-muted) shrink-0">可用字段:</span>
        <button
          v-for="f in fieldsFor(cond.inputName)"
          :key="f"
          class="cursor-pointer rounded border border-(--app-border) bg-(--app-card) px-1.5 py-px text-[10px] text-(--app-text-secondary) transition-colors hover:border-(--app-text-muted) hover:text-(--app-text-primary)"
          :title="`填入字段 '${f}'`"
          @click="patch(idx, { field: f })"
        >{{ f }}</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="list.length === 0"
      class="rounded-lg border border-dashed border-(--app-border) py-3 text-center"
    >
      <p class="text-[11px] text-(--app-text-muted)">暂无判断条件</p>
      <p class="mt-0.5 text-[10px] text-(--app-text-muted)">
        {{ mode === 'OR' ? '任一条件满足走 True，全部不满足走 False' : '所有条件为 AND 关系，全部满足走 True，否则走 False' }}
      </p>
    </div>

    <!-- 添加 -->
    <AppButton variant="ghost" size="sm" @click="add">
      + 添加条件
    </AppButton>
  </div>
</template>
