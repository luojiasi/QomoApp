<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { NODE_TYPE_META, MOTION_API_ENDPOINTS } from '../../configs/selfProcessConfigs'
import type { DataMapping, SkipCondition } from '../../types/selfProcessTypes'
import FlowDataMapping from './FlowDataMapping.vue'
import FlowSkipCondition from './FlowSkipCondition.vue'

const store = useSelfProcessStore()

const node = computed(() => store.selectedNode)
const meta = computed(() => node.value ? NODE_TYPE_META[node.value.type] : null)

const skipConditionsVisible = computed(() =>
  node.value?.type === 'condition' || (node.value?.skipConditions.length ?? 0) > 0
)

const otherNodes = computed(() =>
  (store.currentWorkflow?.nodes ?? []).filter((n) => n.id !== node.value?.id)
)

const operators = [
  { value: 'eq', label: '等于 (==)' },
  { value: 'ne', label: '不等于 (!=)' },
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'contains', label: '包含' }
]

const pathParams = computed(() => {
  const endpoint = String(node.value?.config.apiEndpoint ?? '')
  return Array.from(endpoint.matchAll(/\{([^}]+)\}/g), (match) => match[1])
})

function onApiEndpointChange(): void {
  if (!node.value) return

  const endpoint = String(node.value.config.apiEndpoint ?? '')
  const option = MOTION_API_ENDPOINTS.find((ep) => ep.endpoint === endpoint)
  node.value.config.apiMethod = option?.method ?? 'POST'
  node.value.config.pathParams ??= {}
}

function updatePathParam(paramName: string, value: string): void {
  if (!node.value) return

  const params = {
    ...((node.value.config.pathParams as Record<string, string> | undefined) ?? {}),
    [paramName]: value
  }
  node.value.config.pathParams = params
}

function getPathParamValue(paramName: string): string {
  const params = node.value?.config.pathParams as Record<string, string> | undefined
  return params?.[paramName] ?? ''
}

function onAddDataMapping(mapping: Omit<DataMapping, 'id'>): void {
  if (!node.value) return
  store.addDataMapping(node.value.id, mapping)
}

function onRemoveDataMapping(mappingId: string): void {
  if (!node.value) return
  store.removeDataMapping(node.value.id, mappingId)
}

function onAddSkipCondition(condition: Omit<SkipCondition, 'id'>): void {
  if (!node.value) return
  store.addSkipCondition(node.value.id, condition)
}

function onRemoveSkipCondition(conditionId: string): void {
  if (!node.value) return
  store.removeSkipCondition(node.value.id, conditionId)
}

// apiBody JSON 编辑：将 object <-> string 转换
const apiBodyText = ref('')
watch(
  () => node.value?.config.apiBody,
  (val) => {
    apiBodyText.value = val ? JSON.stringify(val, null, 2) : '{}'
  },
  { immediate: true }
)
function onApiBodyInput(): void {
  if (!node.value) return
  try {
    node.value.config.apiBody = JSON.parse(apiBodyText.value || '{}')
  } catch {
    // JSON 不完整时暂不更新
  }
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
            <span class="text-[11px] font-medium text-(--app-text-secondary)">描述</span>
            <input
              v-model="node.description"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="节点描述"
            />
          </label>
        </div>
      </div>

      <!-- 类型特定配置 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">{{ meta.label }} 参数</div>

        <!-- Task 节点配置 -->
        <template v-if="node.type === 'task'">
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
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
            <label class="flex flex-col gap-1" v-if="node.config.apiEndpoint">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">请求方式</span>
              <input
                v-model="node.config.apiMethod"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                readonly
              />
            </label>
            <label class="flex flex-col gap-1">
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
            </label>
            <label v-for="paramName in pathParams" :key="paramName" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">路径参数 {{ paramName }}</span>
              <input
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :value="getPathParamValue(paramName)"
                :placeholder="paramName"
                @input="updatePathParam(paramName, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <label class="col-span-full flex flex-col gap-1" v-if="node.config.apiEndpoint">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">请求体 (JSON)</span>
            <textarea
              v-model="apiBodyText"
              class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[13px] text-(--app-text-primary) outline-none"
              rows="4"
              placeholder='{"key": "value"}'
              @input="onApiBodyInput"
            />
          </label>
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

      <!-- 数据映射 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">输入数据映射</div>
        <p class="mb-2 text-[11px] text-(--app-text-muted)">配置节点的输入数据来自哪个上游节点的输出</p>
        <FlowDataMapping
          :node-id="node.id"
          :mappings="node.dataMappings"
          :node-type="node.type"
          @add="onAddDataMapping"
          @remove="onRemoveDataMapping"
        />
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
    class="flex items-center justify-center rounded-xl border border-dashed border-(--app-border) bg-(--app-card-soft) p-8"
  >
    <p class="text-[13px] text-(--app-text-muted)">点击画布上的节点进行配置</p>
  </div>
</template>
