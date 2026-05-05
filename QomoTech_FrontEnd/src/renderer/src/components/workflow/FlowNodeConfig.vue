<script setup lang="ts">
import { computed } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { getNodeDefinition } from '../../configs/nodeDefinitions'
import type { NodeProperty } from '../../types/selfProcessTypes'

const store = useSelfProcessStore()

const node = computed(() => store.selectedNode)
const definition = computed(() => node.value ? getNodeDefinition(node.value.type) : null)

/** 获取连接到该节点的目标（从 edges 反查） */
const outgoingEdges = computed(() => {
  if (!node.value || !store.currentWorkflow) return []
  return store.currentWorkflow.edges.filter((e) => e.source === node.value!.id)
})

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
