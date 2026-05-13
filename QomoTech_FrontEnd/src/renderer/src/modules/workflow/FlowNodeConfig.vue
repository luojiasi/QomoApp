<script setup lang="ts">
import { computed } from 'vue'
import { useSelfProcessStore } from '@/stores/selfProcessStores'
import { getNodeDefinition } from '@/configs/nodeDefinitions'
import type { NodeProperty, WorkflowNode } from '@/types/selfProcessTypes'

const store = useSelfProcessStore()

const node = computed(() => store.selectedNode)
const definition = computed(() => node.value ? getNodeDefinition(node.value.type) : null)

/** 获取连接到该节点的目标（从 edges 反查） */
const outgoingEdges = computed(() => {
  if (!node.value || !store.currentWorkflow) return []
  return store.currentWorkflow.edges.filter((e) => e.source === node.value!.id)
})

/** 入边：连入当前节点的边 */
const incomingEdges = computed(() => {
  if (!node.value || !store.currentWorkflow) return []
  return store.currentWorkflow.edges.filter((e) => e.target === node.value!.id)
})

/** 按 targetHandle 获取前驱节点 */
function getPreviousNodeByHandle(targetHandle: string): WorkflowNode | null {
  const edge = incomingEdges.value.find((e) => e.targetHandle === targetHandle)
  if (!edge) return null
  return store.currentWorkflow?.nodes.find((n) => n.id === edge.source) ?? null
}

/** 首个入边的前驱节点（无 targetHandle 过滤） */
const firstPreviousNode = computed<WorkflowNode | null>(() => {
  const edge = incomingEdges.value[0]
  if (!edge) return null
  return store.currentWorkflow?.nodes.find((n) => n.id === edge.source) ?? null
})

/** 首个入边前驱节点的可用输出字段 */
const firstPrevOutputFields = computed<string[]>(() => {
  const fields: string[] = []
  const prevNode = firstPreviousNode.value
  if (!prevNode) return fields

  const def = getNodeDefinition(prevNode.type)
  if (def) {
    for (const port of def.outputs) fields.push(port.name)
  }

  const prevData = store.runContext?.nodeOutputs[prevNode.id]?.data
  if (prevData && typeof prevData === 'object') {
    for (const key of Object.keys(prevData)) {
      if (!fields.includes(key)) fields.push(key)
    }
    for (const [key, val] of Object.entries(prevData)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const subKey of Object.keys(val as Record<string, unknown>)) {
          const path = `${key}.${subKey}`
          if (!fields.includes(path)) fields.push(path)
        }
      }
    }
  }

  return fields
})

/** 前驱节点的可用输出字段（用于 $prev.data.* 联想） */
function getPrevOutputFields(targetHandle: string): string[] {
  const fields: string[] = []
  const prevNode = getPreviousNodeByHandle(targetHandle)
  if (!prevNode) return fields

  const def = getNodeDefinition(prevNode.type)
  if (def) {
    for (const port of def.outputs) {
      fields.push(port.name)
    }
  }

  const prevData = store.runContext?.nodeOutputs[prevNode.id]?.data
  if (prevData && typeof prevData === 'object') {
    for (const key of Object.keys(prevData)) {
      if (!fields.includes(key)) fields.push(key)
    }
    for (const [key, val] of Object.entries(prevData)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const subKey of Object.keys(val as Record<string, unknown>)) {
          const path = `${key}.${subKey}`
          if (!fields.includes(path)) fields.push(path)
        }
      }
    }
  }

  return fields
}

function getTargetLabel(edge: { target: string }): string {
  return store.currentWorkflow?.nodes.find((n) => n.id === edge.target)?.label ?? edge.target
}

// ──── 参数读写 ──────────────────────────────────────────────
function getConfigValue(prop: NodeProperty): unknown {
  if (!node.value) return prop.default
  const val = node.value.config[prop.name]
  return val !== undefined ? val : prop.default
}

function setConfigValue(prop: NodeProperty, rawValue: string): void {
  if (!node.value) return
  let value: unknown = rawValue
  switch (prop.type) {
    case 'number':
      value = Number(rawValue)
      if (Number.isNaN(value)) return
      break
    case 'boolean':
      value = rawValue === 'true'
      break
    case 'json':
      try { value = JSON.parse(rawValue) } catch { /* keep as string during editing */ }
      break
  }
  node.value.config[prop.name] = value
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function isBoolTrue(value: unknown): string {
  return value === true ? 'true' : 'false'
}

// ──── 额外输入端口管理 ─────────────────────────────────────────
const currentExtraInputs = computed(() => node.value?.extraInputs ?? [])

function addExtraInput(): void {
  if (!node.value) return
  if (!node.value.extraInputs) node.value.extraInputs = []
  const index = node.value.extraInputs.length + 1
  node.value.extraInputs.push({
    name: `__extra_${Date.now()}`,
    displayName: `输入${index}`
  })
}

function removeExtraInput(name: string): void {
  if (!node.value?.extraInputs) return
  node.value.extraInputs = node.value.extraInputs.filter((p) => p.name !== name)
}

// ──── 未选中节点时下拉选择 ─────────────────────────────────
function onUnselectedNodeChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  store.selectNode(target.value || null)
}
</script>

<template>
  <div v-if="node && definition" class="max-h-[400px] overflow-y-auto rounded-xl border border-(--app-border) bg-(--app-card)">
    <!-- 头部 -->
    <div class="flex items-center gap-2 border-b border-(--app-border) px-4 py-3 text-sm font-semibold">
      <span>{{ definition.icon }}</span>
      <span class="flex-1">{{ definition.label }} 设置</span>
      <span class="text-[11px] font-normal text-(--app-text-muted)">ID: {{ node.id.slice(0, 8) }}</span>
    </div>

    <div class="px-4 py-3">
      <!-- 基础属性 -->
      <div class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">基础属性</div>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">节点名称</span>
            <input
              v-model="node.label"
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
              placeholder="输入节点名称"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-(--app-text-secondary)">节点类型</span>
            <input
              class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-muted) outline-none"
              :value="definition.label"
              readonly
            />
          </label>
        </div>
      </div>

      <!-- 节点参数（来自 definition.properties） -->
      <div v-if="definition.properties.length > 0" class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">
          {{ definition.label }} 参数
        </div>
        <div class="grid grid-cols-2 gap-2">
          <template v-for="prop in definition.properties" :key="prop.name">
            <!-- string -->
            <label v-if="prop.type === 'string'" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">
                {{ prop.displayName }}
                <span v-if="prop.required" class="text-red-500">*</span>
              </span>
              <input
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :placeholder="prop.placeholder ?? ''"
                :value="formatValue(getConfigValue(prop))"
                @input="setConfigValue(prop, ($event.target as HTMLInputElement).value)"
              />
              <!-- 设置变量 value 字段的前驱输出联想 -->
              <div
                v-if="prop.name === 'value' && node?.type === 'flow.setVariable' && firstPrevOutputFields.length > 0"
                class="flex flex-wrap items-center gap-1 mt-0.5"
              >
                <span class="text-[10px] text-(--app-text-muted)">前驱输出:</span>
                <button
                  v-for="field in firstPrevOutputFields"
                  :key="field"
                  class="cursor-pointer rounded border border-(--app-border) bg-(--app-card-soft) px-1.5 py-0.5 text-[10px] font-mono text-(--app-text-secondary) transition-colors hover:border-blue-500 hover:text-blue-600"
                  :title="`插入 $prev.data.${field}`"
                  @click="setConfigValue(prop, `$prev.data.${field}`)"
                >
                  $prev.data.{{ field }}
                </button>
              </div>
              <!-- 左操作数联想（条件判断 input 端口） -->
              <div
                v-if="prop.name === 'leftOperand' && getPrevOutputFields('input').length > 0"
                class="flex flex-wrap items-center gap-1 mt-0.5"
              >
                <span class="text-[10px] text-(--app-text-muted)">左输入:</span>
                <button
                  v-for="field in getPrevOutputFields('input')"
                  :key="field"
                  class="cursor-pointer rounded border border-(--app-border) bg-(--app-card-soft) px-1.5 py-0.5 text-[10px] font-mono text-(--app-text-secondary) transition-colors hover:border-blue-500 hover:text-blue-600"
                  :title="`插入 $prev.data.${field}`"
                  @click="setConfigValue(prop, `$prev.data.${field}`)"
                >
                  $prev.data.{{ field }}
                </button>
              </div>
              <!-- 右操作数联想（条件判断 compare 端口） -->
              <div
                v-if="prop.name === 'rightOperand' && getPrevOutputFields('compare').length > 0"
                class="flex flex-wrap items-center gap-1 mt-0.5"
              >
                <span class="text-[10px] text-(--app-text-muted)">右输入:</span>
                <button
                  v-for="field in getPrevOutputFields('compare')"
                  :key="field"
                  class="cursor-pointer rounded border border-(--app-border) bg-(--app-card-soft) px-1.5 py-0.5 text-[10px] font-mono text-(--app-text-secondary) transition-colors hover:border-blue-500 hover:text-blue-600"
                  :title="`插入 $prev.data.${field}`"
                  @click="setConfigValue(prop, `$prev.data.${field}`)"
                >
                  $prev.data.{{ field }}
                </button>
              </div>
            </label>

            <!-- number -->
            <label v-else-if="prop.type === 'number'" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">
                {{ prop.displayName }}
                <span v-if="prop.required" class="text-red-500">*</span>
              </span>
              <input
                type="number"
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :placeholder="prop.placeholder ?? ''"
                :value="getConfigValue(prop)"
                @input="setConfigValue(prop, ($event.target as HTMLInputElement).value)"
              />
            </label>

            <!-- boolean -->
            <label v-else-if="prop.type === 'boolean'" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">
                {{ prop.displayName }}
                <span v-if="prop.required" class="text-red-500">*</span>
              </span>
              <select
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :value="isBoolTrue(getConfigValue(prop))"
                @change="setConfigValue(prop, ($event.target as HTMLSelectElement).value)"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>

            <!-- select -->
            <label v-else-if="prop.type === 'select'" class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">
                {{ prop.displayName }}
                <span v-if="prop.required" class="text-red-500">*</span>
              </span>
              <select
                class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
                :value="formatValue(getConfigValue(prop))"
                @change="setConfigValue(prop, ($event.target as HTMLSelectElement).value)"
              >
                <option v-if="!prop.required" value="">-- 选择 --</option>
                <option v-for="opt in prop.options ?? []" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>

            <!-- json (textarea, colspan full) -->
            <label v-else-if="prop.type === 'json'" class="col-span-full flex flex-col gap-1">
              <span class="text-[11px] font-medium text-(--app-text-secondary)">
                {{ prop.displayName }}
                <span v-if="prop.required" class="text-red-500">*</span>
              </span>
              <textarea
                class="resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 font-mono text-[12px] text-(--app-text-primary) outline-none focus:border-blue-600"
                rows="6"
                :placeholder="prop.placeholder ?? ''"
                :value="formatValue(getConfigValue(prop))"
                @input="setConfigValue(prop, ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </template>
        </div>
      </div>

      <!-- 连线关系 -->
      <div v-if="outgoingEdges.length > 0" class="mb-4">
        <div class="mb-1 text-[13px] font-semibold text-(--app-text-primary)">连线目标</div>
        <div class="flex flex-col gap-1">
          <div
            v-for="edge in outgoingEdges"
            :key="edge.id"
            class="rounded-md bg-(--app-card-soft) px-2.5 py-1 text-[12px] text-(--app-text-secondary)"
          >
            → {{ getTargetLabel(edge) }}
          </div>
        </div>
      </div>

      <!-- 额外输入端口 -->
      <div class="mb-4">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[13px] font-semibold text-(--app-text-primary)">额外输入端口</span>
          <button
            class="cursor-pointer rounded border border-(--app-border) bg-(--app-card-soft) px-2 py-0.5 text-[11px] text-(--app-text-secondary) transition-colors hover:border-purple-500 hover:text-purple-500"
            @click="addExtraInput"
          >+ 添加</button>
        </div>
        <p class="mb-1.5 text-[10px] text-(--app-text-muted)">
          多个不同端口 → 全部连入后才执行（AND）；同一端口多连线 → 任一触发（OR）
        </p>
        <div v-if="currentExtraInputs.length > 0" class="flex flex-col gap-1">
          <div
            v-for="port in currentExtraInputs"
            :key="port.name"
            class="flex items-center gap-2 rounded-md bg-(--app-card-soft) px-2.5 py-1"
          >
            <span class="h-2 w-2 rounded-full bg-purple-400 flex-shrink-0" />
            <span class="flex-1 text-[12px] text-(--app-text-secondary)">{{ port.displayName }}</span>
            <button
              class="cursor-pointer border-0 bg-transparent text-[11px] text-(--app-text-muted) transition-colors hover:text-red-500"
              @click="removeExtraInput(port.name)"
              title="移除此端口"
            >删除</button>
          </div>
        </div>
        <div v-else class="text-[11px] text-(--app-text-muted) italic">未添加额外输入端口</div>
      </div>
    </div>
  </div>

  <!-- 未选中节点 / 节点类型未定义 -->
  <div
    v-else
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-(--app-border) bg-(--app-card-soft) p-6"
  >
    <p class="text-[13px] text-(--app-text-muted)">点击画布上的节点进行配置</p>
    <select
      v-if="(store.currentWorkflow?.nodes.length ?? 0) > 0"
      class="w-full max-w-72 rounded-md border border-(--app-border) bg-(--app-input-bg) px-2.5 py-1.5 text-[13px] text-(--app-text-primary) outline-none focus:border-blue-600"
      :value="store.selectedNodeId ?? ''"
      @change="onUnselectedNodeChange"
    >
      <option value="">-- 选择一个节点 --</option>
      <option v-for="n in store.currentWorkflow?.nodes ?? []" :key="n.id" :value="n.id">
        {{ n.label }} ({{ n.type }})
      </option>
    </select>
    <p v-else class="text-[12px] text-(--app-text-muted)">当前流程暂无节点</p>
  </div>
</template>
