<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { NODE_TYPE_META, MOTION_API_ENDPOINTS } from '../../configs/selfProcessConfigs'
import type { SkipCondition } from '../../types/selfProcessTypes'
import FlowSkipCondition from './FlowSkipCondition.vue'

const store = useSelfProcessStore()

// 当前选中的节点（来自全局 store）
const node = computed(() => store.selectedNode)
// 当前节点类型的元数据（图标、颜色、名称）
const meta = computed(() => node.value ? NODE_TYPE_META[node.value.type] : null)
// 是否显示 API Body 的 JSON 文本视图
const showApiBodyJson = ref(false)

// 条件节点或存在跳转条件时显示条件跳转模块
const skipConditionsVisible = computed(() =>
  node.value?.type === 'condition' || (node.value?.skipConditions.length ?? 0) > 0
)
// 默认下一个节点候选（排除当前节点）
const otherNodes = computed(() =>
  (store.currentWorkflow?.nodes ?? []).filter((n) => n.id !== node.value?.id)
)
// 未选中节点状态下可选择的全部节点
const availableNodes = computed(() => store.currentWorkflow?.nodes ?? [])
// 解析 API 路径中的占位参数，如 /api/{id}
const pathParams = computed(() => {
  const endpoint = String(node.value?.config.apiEndpoint ?? '')
  return Array.from(endpoint.matchAll(/\{([^}]+)\}/g), (match) => match[1])
})
// 将 apiBody 转为模板可渲染的字段结构
const apiBodyEntries = computed(() =>
  Object.entries(getApiBody()).map(([key, value]) => ({
    key,
    value,
    isBoolean: typeof value === 'boolean',
    isNumber: typeof value === 'number',
    isComplex: value !== null && typeof value === 'object',
    hasObjectCards: getObjectCards(value).length > 0
  }))
)
// apiBody 的格式化 JSON 字符串
const apiBodyJsonText = computed(() => JSON.stringify(getApiBody(), null, 2))



// 条件节点支持的运算符列表
const operators = [
  { value: 'eq', label: '等于 (==)' },
  { value: 'ne', label: '不等于 (!=)' },
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'contains', label: '包含' }
]





// 当 API 端点变更时，同步刷新请求方法、默认 body 和路径参数容器
function onApiEndpointChange(): void {
  if (!node.value) return

  const endpoint = String(node.value.config.apiEndpoint ?? '')
  const option = MOTION_API_ENDPOINTS.find((ep) => ep.endpoint === endpoint)
  node.value.config.apiMethod = option?.method ?? 'POST'
  node.value.config.apiBody = cloneDefaultBody(option?.defaultBody)
  node.value.config.pathParams ??= {}
}

// 深拷贝默认请求体，避免引用同一对象导致串改
function cloneDefaultBody(defaultBody?: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(defaultBody ?? {})) as Record<string, unknown>
}

// 更新路径参数中的某一项
function updatePathParam(paramName: string, value: string): void {
  if (!node.value) return

  const params = {
    ...((node.value.config.pathParams as Record<string, string> | undefined) ?? {}),
    [paramName]: value
  }
  node.value.config.pathParams = params
}

// 获取某个路径参数当前值（不存在时返回空字符串）
function getPathParamValue(paramName: string): string {
  const params = node.value?.config.pathParams as Record<string, string> | undefined
  return params?.[paramName] ?? ''
}

// 安全读取 apiBody，确保始终返回可编辑的对象结构
function getApiBody(): Record<string, unknown> {
  const apiBody = node.value?.config.apiBody
  if (!apiBody || typeof apiBody !== 'object' || Array.isArray(apiBody)) return {}
  return apiBody as Record<string, unknown>
}

// 判断值是否为普通对象（排除 null 和数组）
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// 将对象值转换为“卡片 + 字段”结构，便于模板渲染复杂参数
function getObjectCards(value: unknown): Array<{
  key: string
  fields: Array<{
    key: string
    value: unknown
    isBoolean: boolean
    isNumber: boolean
    isComplex: boolean
  }>
}> {
  if (!isRecord(value)) return []

  const entries = Object.entries(value)
  if (entries.length === 0) return []

  const isNestedRecord = entries.every(([, childValue]) => isRecord(childValue))
  if (isNestedRecord) {
    return entries.map(([key, childValue]) => ({
      key,
      fields: getObjectFieldEntries(childValue as Record<string, unknown>)
    }))
  }

  return [{ key: '', fields: getObjectFieldEntries(value) }]
}

// 将对象字段映射成统一的渲染描述（类型标记 + 原始值）
function getObjectFieldEntries(value: Record<string, unknown>): Array<{
  key: string
  value: unknown
  isBoolean: boolean
  isNumber: boolean
  isComplex: boolean
}> {
  return Object.entries(value).map(([key, fieldValue]) => ({
    key,
    value: fieldValue,
    isBoolean: typeof fieldValue === 'boolean',
    isNumber: typeof fieldValue === 'number',
    isComplex: fieldValue !== null && typeof fieldValue === 'object'
  }))
}

// 将任意 apiBody 值格式化为输入框/文本域可显示的字符串
function formatApiBodyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// 更新 apiBody 顶层字段值，并按原有类型进行解析
function updateApiBodyValue(key: string, value: string): void {
  if (!node.value) return

  const apiBody = { ...getApiBody() }
  const previousValue = apiBody[key]
  apiBody[key] = parseApiBodyValue(value, previousValue)
  node.value.config.apiBody = apiBody
}

// 更新 apiBody 嵌套卡片字段值（支持 card 场景与普通对象场景）
function updateApiBodyCardValue(parentKey: string, cardKey: string, fieldKey: string, value: string): void {
  if (!node.value) return

  const apiBody = { ...getApiBody() }
  const parentValue = apiBody[parentKey]
  if (!isRecord(parentValue)) return

  if (cardKey) {
    const parent = { ...parentValue }
    const cardValue = parent[cardKey]
    if (!isRecord(cardValue)) return

    const card = { ...cardValue }
    const previousValue = card[fieldKey]
    card[fieldKey] = parseApiBodyValue(value, previousValue)
    parent[cardKey] = card
    apiBody[parentKey] = parent
  } else {
    const parent = { ...parentValue }
    const previousValue = parent[fieldKey]
    parent[fieldKey] = parseApiBodyValue(value, previousValue)
    apiBody[parentKey] = parent
  }

  node.value.config.apiBody = apiBody
}

// 按历史值类型解析输入内容，减少类型漂移
function parseApiBodyValue(value: string, previousValue: unknown): unknown {
  if (typeof previousValue === 'number') {
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? previousValue : numberValue
  }
  if (typeof previousValue === 'boolean') return value === 'true'
  if (previousValue !== null && typeof previousValue === 'object') {
    try {
      return JSON.parse(value)
    } catch {
      return previousValue
    }
  }
  return value
}

// 新增条件跳转
function onAddSkipCondition(condition: Omit<SkipCondition, 'id'>): void {
  if (!node.value) return
  store.addSkipCondition(node.value.id, condition)
}

// 删除条件跳转
function onRemoveSkipCondition(conditionId: string): void {
  if (!node.value) return
  store.removeSkipCondition(node.value.id, conditionId)
}

// 未选中节点时，通过下拉框切换当前选中节点
function onUnselectedNodeChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  const nodeId = target.value
  store.selectNode(nodeId || null)
}

</script>

<template>
  <div v-if="node && meta" class="max-h-[400px] overflow-y-auto rounded-xl border border-(--app-border) bg-(--app-card)">
    <div class="flex items-center gap-2 border-b border-(--app-border) px-4 py-3 text-sm font-semibold">
      <span class="text-lg">{{ meta.icon }}</span>
      <span class="flex-1">{{ meta.label }} 设置</span>

      <span
        class="text-[11px] font-normal"
        :style="{ color: meta.color }"
      >ID: {{ node.id.slice(0, 8) }}</span>
      <button class="text-[11px] font-normal text-(--app-text-secondary) hover:text-blue-600" >
        删除该节点
      </button>
    </div>

    <div class="px-4 py-3">
      <!-- 基础属性 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">基础属性</div>
        <div class="grid grid-cols-4 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">节点名称</span>
            <input
              v-model="node.label"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="输入节点名称"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">节点位置</span>
            <div class="grid grid-cols-2 gap-2">
            <input
              v-model.number="node.position.x"
              type="number"
              min="0"
              max="999"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="输入节点位置X"
            />
            <input
              v-model.number="node.position.y"
              type="number"
              min="0"
              max="999"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="输入节点位置Y"
            />
          </div>
          </label>
          <label v-if="node.type === 'task'" class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">后端 API</span>
            <select
              v-model="node.config.apiEndpoint"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              @change="onApiEndpointChange"
            >
              <option value="">-- 选择 API --</option>
              <option v-for="ep in MOTION_API_ENDPOINTS" :key="ep.endpoint" :value="ep.endpoint">
                {{ ep.label }}
              </option>
            </select>
          </label>
          <label v-if="node.type === 'task' && node.config.apiEndpoint" class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">请求方式</span>
            <input
              v-model="node.config.apiMethod"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              readonly
            />
          </label>
          <!-- <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">描述</span>
            <input
              v-model="node.description"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="节点描述"
            />
          </label> -->
        </div>
      </div>

      <!-- 类型特定配置 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">{{ meta.label }} 参数</div>

        <!-- Task 节点配置 -->
        <template v-if="node.type === 'task'">
          <div class="grid grid-cols-4 gap-2">
            <label v-for="paramName in pathParams" :key="paramName" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">路径参数 {{ paramName }}</span>
              <input
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :value="getPathParamValue(paramName)"
                :placeholder="paramName"
                @input="updatePathParam(paramName, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <!-- <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">超时 (秒)</span>
              <input
                v-model.number="node.config.timeout"
                type="number"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                min="1"
                max="300"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">重试次数</span>
              <input
                v-model.number="node.config.retryCount"
                type="number"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                min="0"
                max="10"
              />
            </label> -->

          </div>
          <div
            v-if="node.config.apiEndpoint && apiBodyEntries.length > 0"
            class="col-span-full mt-2 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-[11px] font-medium text-(--app-text-secondary)">请求参数</div>
              <button
                type="button"
                class="cursor-pointer rounded-md border border-(--app-border) bg-transparent px-2 py-1 text-[11px] text-(--app-text-secondary) hover:border-blue-600 hover:text-blue-600"
                @click="showApiBodyJson = !showApiBodyJson"
              >
                {{ showApiBodyJson ? '隐藏 JSON' : '显示 JSON' }}
              </button>
            </div>
            <div class="grid grid-cols-6 gap-2">
              <div
                v-for="entry in apiBodyEntries"
                :key="entry.key"
                class="flex flex-col gap-1"
                :class="entry.isComplex ? 'col-span-full' : ''"
              >
                <span class="text-[11px] font-medium text-(--app-text-secondary)">{{ entry.key }}</span>
                <select
                  v-if="entry.isBoolean"
                  class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                  :value="String(entry.value)"
                  @change="updateApiBodyValue(entry.key, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <div
                  v-else-if="entry.hasObjectCards"
                  class="flex flex-col gap-2 rounded-md border border-(--app-border) bg-(--app-card-soft) p-2"
                >
                  <div
                    v-for="card in getObjectCards(entry.value)"
                    :key="card.key || entry.key"
                    class="rounded-md border border-(--app-border) bg-(--app-card) p-2"
                  >
                    <div
                      v-if="card.key"
                      class="mb-2 text-[11px] font-semibold text-(--app-text-primary)"
                    >
                      {{ card.key }}
                    </div>
                    <div class="grid grid-cols-8 gap-2">
                      <label
                        v-for="field in card.fields"
                        :key="field.key"
                        class="flex flex-col gap-1"
                        :class="field.isComplex ? 'col-span-full' : ''"
                      >
                        <span class="text-[11px] font-medium text-(--app-text-secondary)">
                          {{ field.key }}
                        </span>
                        <select
                          v-if="field.isBoolean"
                          class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                          :value="String(field.value)"
                          @change="updateApiBodyCardValue(entry.key, card.key, field.key, ($event.target as HTMLSelectElement).value)"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                        <textarea
                          v-else-if="field.isComplex"
                          class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                          rows="3"
                          :value="formatApiBodyValue(field.value)"
                          @input="updateApiBodyCardValue(entry.key, card.key, field.key, ($event.target as HTMLTextAreaElement).value)"
                        />
                        <input
                          v-else
                          class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                          :type="field.isNumber ? 'number' : 'text'"
                          :value="formatApiBodyValue(field.value)"
                          @input="updateApiBodyCardValue(entry.key, card.key, field.key, ($event.target as HTMLInputElement).value)"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <textarea
                  v-else-if="entry.isComplex"
                  class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                  rows="3"
                  :value="formatApiBodyValue(entry.value)"
                  @input="updateApiBodyValue(entry.key, ($event.target as HTMLTextAreaElement).value)"
                />
                <input
                  v-else
                  class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                  :type="entry.isNumber ? 'number' : 'text'"
                  :value="formatApiBodyValue(entry.value)"
                  @input="updateApiBodyValue(entry.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
            <label v-if="showApiBodyJson" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">JSON 格式</span>
              <textarea
                class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[13px] text-(--app-text-primary) outline-none"
                rows="6"
                readonly
                :value="apiBodyJsonText"
              />
            </label>
          </div>
        </template>

        <!-- Condition 节点配置 -->
        <template v-if="node.type === 'condition'">
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">运算符</span>
              <select
                v-model="node.config.operator"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              >
                <option v-for="op in operators" :key="op.value" :value="op.value">
                  {{ op.label }}
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">比较值</span>
              <input
                v-model="node.config.compareValue"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                placeholder="输入比较值"
              />
            </label>
          </div>
        </template>

        <!-- Delay 节点配置 -->
        <template v-if="node.type === 'delay'">
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">等待类型</span>
              <select
                v-model="node.config.delayType"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              >
                <option value="fixed">固定时间</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">等待秒数</span>
              <input
                v-model.number="node.config.fixedSeconds"
                type="number"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                min="0.1"
                step="0.5"
              />
            </label>
          </div>
        </template>

        <!-- Loop 节点配置 -->
        <template v-if="node.type === 'loop'">
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">循环次数</span>
              <input
                v-model.number="node.config.count"
                type="number"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                min="1"
                max="999"
              />
            </label>
          </div>
        </template>
      </div>

      <!-- 跳转条件 -->
      <div v-if="skipConditionsVisible" class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">条件跳转</div>
        <p class="mb-2 text-[11px] text-(--app-text-muted)">满足条件时跳转到指定节点</p>
        <FlowSkipCondition
          :node-id="node.id"
          :conditions="node.skipConditions"
          :nodes="store.currentWorkflow?.nodes ?? []"
          @add="onAddSkipCondition"
          @remove="onRemoveSkipCondition"
        />
      </div>

      <!-- 默认下一个节点 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">默认下一个节点</div>
        <label class="flex flex-col gap-1">
          <select
            v-model="node.nextNodeId"
            class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
          >
            <option :value="null">-- 无 (流程结束) --</option>
            <option v-for="n in otherNodes" :key="n.id" :value="n.id">
              {{ n.label }} ({{ n.type }})
            </option>
          </select>
        </label>
      </div>
    </div>
  </div>

  <!-- 未选中节点时 -->
  <div
    v-else
    class="flex flex-row items-center justify-center gap-3 rounded-xl border border-dashed border-(--app-border) bg-(--app-card-soft) p-8"
  >
    <p class="text-[13px] text-(--app-text-muted)">点击画布上的节点进行配置</p>
    <select
      v-if="availableNodes.length > 0"
      class="w-full max-w-72 rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
      :value="store.selectedNodeId ?? ''"
      @change="onUnselectedNodeChange"
    >
      <option value="">-- 选择一个节点进行配置 --</option>
      <option v-for="n in availableNodes" :key="n.id" :value="n.id">
        {{ n.label }} ({{ n.type }})
      </option>
    </select>
    <p v-else class="text-[12px] text-(--app-text-muted)">当前流程暂无节点，请先在画布中添加节点</p>
  </div>
</template>
