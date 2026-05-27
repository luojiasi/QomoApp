<script setup lang="ts">
// SelfProcessPage_ConditionEditor.vue — IF 节点条件列表编辑器
//
// 每行：输入端口选择 → 字段名 → 运算符 → 比较值 → 删除
// 底部 + 添加条件按钮

import { computed } from 'vue'
import AppSelect from '../UI/AppSelect.vue'
import AppInput from '../UI/AppInput.vue'
import AppButton from '../UI/AppButton.vue'
import { CONDITION_OPERATORS } from '../constants/conditionOperators'
import type { IfCondition } from '../types/workflow'

const props = defineProps<{
  conditions: IfCondition[] | unknown
  inputNames: { name: string; displayName: string }[]
}>()

const emit = defineEmits<{ 'update:conditions': [IfCondition[]] }>()

const list = computed(() =>
  Array.isArray(props.conditions) ? (props.conditions as IfCondition[]) : []
)

const inputOptions = computed(() =>
  props.inputNames.map(n => ({ label: n.displayName, value: n.name }))
)

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

/** 数字类型的比较值用数字，否则用字符串 */
function castValue(raw: string): string | number {
  const n = Number(raw)
  return raw !== '' && !isNaN(n) ? n : raw
}
</script>

<template>
  <div class="space-y-2">
    <!-- 条件行 -->
    <div
      v-for="(cond, idx) in list"
      :key="idx"
      class="flex items-start gap-1 rounded-lg border border-(--app-border) bg-(--app-card-soft) p-2"
    >
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
        class="w-[56px] shrink-0"
        @update:model-value="patch(idx, { field: $event as string })"
      />

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

    <!-- 空状态 -->
    <div
      v-if="list.length === 0"
      class="rounded-lg border border-dashed border-(--app-border) py-3 text-center"
    >
      <p class="text-[11px] text-(--app-text-muted)">暂无判断条件</p>
      <p class="mt-0.5 text-[10px] text-(--app-text-muted)">
        所有条件为 AND 关系，全部满足走 True，否则走 False
      </p>
    </div>

    <!-- 添加 -->
    <AppButton variant="ghost" size="sm" @click="add">
      + 添加条件
    </AppButton>
  </div>
</template>
