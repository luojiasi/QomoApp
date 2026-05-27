// ─────────────────────────────────────────────────────────────
// constants/conditionOperators.ts — IF 节点比较运算符选项
// ─────────────────────────────────────────────────────────────

export interface ConditionOperatorOption {
  label: string
  value: string
}

export const CONDITION_OPERATORS: ConditionOperatorOption[] = [
  { label: '等于 (==)',     value: 'eq' },
  { label: '不等于 (!=)',   value: 'neq' },
  { label: '大于 (>)',      value: 'gt' },
  { label: '小于 (<)',      value: 'lt' },
  { label: '大于等于 (>=)', value: 'gte' },
  { label: '小于等于 (<=)', value: 'lte' }
]
