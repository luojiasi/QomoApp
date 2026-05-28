<script setup lang="ts">
// SelfProcessPage_NodeSettings.vue — 右侧节点参数配置面板
//
// 显示当前选中节点的可编辑参数。
// 节点蓝图（NodeTypeDef）中定义了哪些参数，这里动态渲染对应表单控件。
import { computed, ref } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'
import AppToggle from '../UI/AppToggle.vue'
import AppSelect from '../UI/AppSelect.vue'
import AppInput from '../UI/AppInput.vue'
import SelfProcessPage_ConditionEditor from './SelfProcessPage_ConditionEditor.vue'
import type { IfCondition } from '../types/workflow'
import { inferUpstreamFields } from '../utils/upstreamFieldUtils'

const store = useWorkflowStore()

const node = computed(() => store.selectedNode)
const def  = computed(() => node.value ? (NODE_REGISTRY[node.value.type] ?? null) : null)
const style = computed(() => def.value ? NODE_CATEGORY_STYLES[def.value.category] : null)

// 计算所有可用输入端口名（静态 + extraInputCount 动态生成）
const availableInputNames = computed(() => {
  const base = def.value?.inputs ?? []
  const count = Number(node.value?.params?.extraInputCount)
  const extra: { name: string; displayName: string }[] = []
  if (Number.isFinite(count) && count > 0) {
    for (let i = 1; i <= Math.min(count, 10); i++) {
      extra.push({ name: `input_${i}`, displayName: `输入${i}` })
    }
  }
  return [...base, ...extra]
})

const upstreamFields = computed(() => {
  const wf = store.currentWorkflow
  return wf && node.value ? inferUpstreamFields(wf, node.value.id) : {}
})

// 当前节点 'main' 端口的上游字段列表（供 field 类参数使用）
const mainPortFields = computed(() => upstreamFields.value['main'] ?? [])

// 是否有上游连线
const hasUpstreamEdges = computed(() => {
  const wf = store.currentWorkflow
  if (!wf || !node.value) return false
  return wf.edges.some(e => e.target === node.value!.id)
})

// 上游节点的实际输出数据
const upstreamOutputData = computed(() => {
  const wf = store.currentWorkflow
  if (!wf || !node.value) return {} as Record<string, Record<string, unknown>>
  const result: Record<string, Record<string, unknown>> = {}
  for (const edge of wf.edges) {
    if (edge.target !== node.value.id) continue
    const portName = edge.targetHandle ?? 'main'
    const srcOutput = store.nodeOutputs[edge.source]
    if (srcOutput) {
      result[portName] = { ...result[portName], ...srcOutput }
    }
  }
  return result
})

// 数据查看器弹出状态
const popoverParam = ref<string | null>(null)

function togglePopover(paramName: string): void {
  popoverParam.value = popoverParam.value === paramName ? null : paramName
}

function onSelectUpstreamPath(path: string): void {
  if (!popoverParam.value || !node.value) return
  store.updateNode(node.value.id, {
    params: { ...node.value.params, [popoverParam.value]: '$' + path }
  })
  popoverParam.value = null
}

// 是否有上游数据
const upstreamHasData = computed(() => mainPortFields.value.length > 0)

function showUpstreamHints(param: { name: string; type: string }): boolean {
  return param.type === 'string' || param.type === 'number' || param.type === 'expression'
}

// 判断参数是否满足 showWhen 条件（应显示）
function isParamVisible(showWhen?: { field: string; value: unknown }): boolean {
  if (!showWhen || !node.value) return true
  return node.value.params[showWhen.field] === showWhen.value
}

// 修改节点某个 param 的值
function setParam(name: string, value: unknown): void {
  if (!node.value) return
  store.updateNode(node.value.id, {
    params: { ...node.value.params, [name]: value }
  })
}

// 修改节点名称
function setLabel(value: string): void {
  if (!node.value) return
  store.updateNode(node.value.id, { label: value })
}

// 修改节点备注
function setDescription(value: string): void {
  if (!node.value) return
  store.updateNode(node.value.id, { description: value })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col text-sm">

    <!-- 未选中节点 -->
    <div
      v-if="!node"
      class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <span class="text-2xl opacity-30">☖</span>
      <p class="text-[12px] text-(--app-text-muted)">点击画布上的节点<br>在这里编辑参数</p>
    </div>

    <!-- 已选中节点 -->
    <template v-else>

      <!-- 节点头部信息（颜色条 + 类型名） -->
      <div
        class="shrink-0 px-4 py-3"
        :style="style ? { background: style.headerBg } : {}"
      >
        <div class="flex items-center gap-2">
          <span class="text-base leading-none" :style="style ? { color: style.headerText } : {}">
            {{ def?.icon ?? '◈' }}
          </span>
          <span
            class="text-[11px] font-semibold tracking-wide"
            :style="style ? { color: style.headerText } : {}"
          >
            {{ def?.displayName ?? node.type }}
          </span>
        </div>
      </div>

      <!-- 参数表单 -->
      <div class="wf-scroll-y min-h-0 flex-1 p-4">

        <!-- 基础信息 -->
        <section class="mb-4">
          <h4 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-(--app-text-muted)">基础信息</h4>
          <div class="flex gap-2">
            <div class="min-w-0 flex-1">
              <label class="mb-1 block text-[11px] text-(--app-text-muted)">名称</label>
              <AppInput
                :model-value="node.label"
                placeholder="节点名称"
                @update:model-value="setLabel($event as string)"
              />
            </div>
            <div class="min-w-0 flex-1">
              <label class="mb-1 block text-[11px] text-(--app-text-muted)">备注</label>
              <AppInput
                :model-value="node.description"
                placeholder="可选备注"
                @update:model-value="setDescription($event as string)"
              />
            </div>
          </div>
        </section>

        <!-- 节点参数（来自蓝图 NodeTypeDef.params） -->
        <section v-if="def && def.params.length > 0">
          <h4 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-(--app-text-muted)">参数</h4>
          <div class="space-y-3">
            <template v-for="param in def.params" :key="param.name">
              <div v-if="isParamVisible(param.showWhen)">
                <label class="mb-1 block text-[11px] text-(--app-text-muted)">
                  {{ param.displayName }}
                  <span v-if="param.required" class="text-red-400">*</span>
                </label>

                <!-- boolean → 开关 -->
                <AppToggle
                  v-if="param.type === 'boolean'"
                  :model-value="!!(node.params[param.name] ?? param.default)"
                  :label="param.description ?? ''"
                  @update:model-value="setParam(param.name, $event)"
                />

                <!-- select → 下拉 -->
                <AppSelect
                  v-else-if="param.type === 'select'"
                  :model-value="(node.params[param.name] ?? param.default) as string"
                  :options="(param.options ?? []) as { label: string; value: string | number }[]"
                  :placeholder="param.placeholder"
                  @update:model-value="setParam(param.name, $event)"
                />

                <!-- date → 日期选择 -->
                <AppInput
                  v-else-if="param.type === 'date'"
                  :model-value="(node.params[param.name] ?? param.default) as string"
                  :placeholder="param.placeholder"
                  type="date"
                  @update:model-value="setParam(param.name, $event)"
                />

                <!-- time → 时间输入 -->
                <AppInput
                  v-else-if="param.type === 'time'"
                  :model-value="(node.params[param.name] ?? param.default) as string"
                  :placeholder="param.placeholder"
                  type="time"
                  @update:model-value="setParam(param.name, $event)"
                />

                <!-- conditionList → 条件编辑器 -->
                <SelfProcessPage_ConditionEditor
                  v-else-if="param.type === 'conditionList'"
                  :conditions="node.params[param.name]"
                  :input-names="availableInputNames"
                  :upstream-fields="upstreamFields"
                  :mode="(node.params.conditionMode as string) ?? 'AND'"
                  @update:conditions="setParam(param.name, $event as IfCondition[])"
                  @update:mode="setParam('conditionMode', $event)"
                />

                <!-- string / number / expression / json → 文本输入 -->
                <div v-else class="flex gap-1">
                  <AppInput
                    class="flex-1"
                    :model-value="String(node.params[param.name] ?? param.default ?? '')"
                    :placeholder="param.placeholder ?? param.displayName"
                    :type="param.type === 'number' ? 'number' : 'text'"
                    @update:model-value="
                      setParam(param.name, param.type === 'number' ? Number($event) : $event)
                    "
                  />
                  <button
                    v-if="showUpstreamHints(param) && hasUpstreamEdges"
                    class="shrink-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-(--app-border) text-[13px] text-(--app-text-muted) transition-colors hover:bg-(--app-card-soft) hover:text-(--app-text-primary)"
                    title="查看上游数据"
                    @click="togglePopover(param.name)"
                  >⊞</button>
                </div>

                <p v-if="param.description && param.type !== 'boolean'" class="mt-0.5 text-[10px] text-(--app-text-muted)">
                  {{ param.description }}
                </p>

                <!-- 字段提示：string/number/expression 参数有上游字段时，显示可选字段名 -->
                <div
                  v-if="showUpstreamHints(param) && mainPortFields.length > 0"
                  class="mt-1 flex items-center gap-1 flex-wrap"
                >
                  <span class="text-[10px] text-(--app-text-muted) shrink-0">可用字段:</span>
                  <button
                    v-for="f in mainPortFields"
                    :key="f"
                    class="cursor-pointer rounded border border-(--app-border) bg-(--app-card) px-1.5 py-px text-[10px] text-(--app-text-secondary) transition-colors hover:border-(--app-text-muted) hover:text-(--app-text-primary)"
                    :title="`填入字段 '${f}'`"
                    @click="setParam(param.name, f)"
                  >{{ f }}</button>
                  <button
                    v-if="upstreamHasData && node.params[param.name] !== '$main'"
                    class="cursor-pointer rounded border border-green-500/40 bg-green-600/10 px-1.5 py-px text-[10px] text-green-500 transition-colors hover:bg-green-600/20"
                    :title="`引用上游完整数据`"
                    @click="setParam(param.name, '$main')"
                  >引用上游</button>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- 蓝图未注册时的提示 -->
        <div v-else-if="!def" class="rounded-lg border border-dashed border-(--app-border) p-4 text-center">
          <p class="text-[11px] text-(--app-text-muted)">节点类型 <code class="font-mono">{{ node.type }}</code> 尚未注册蓝图</p>
        </div>


      </div>

      <!-- 上游数据查看器（固定到底部） -->
      <section
        v-if="popoverParam"
        class="shrink-0 border-t border-(--app-border) px-4 py-3"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-semibold text-(--app-text-primary)">
            上游数据 → {{ popoverParam }}
          </span>
          <button
            class="cursor-pointer border-0 bg-transparent text-[11px] text-(--app-text-muted) hover:text-(--app-text-primary)"
            @click="popoverParam = null"
          >✕</button>
        </div>
        <div class="max-h-[200px] wf-scroll-y">
          <div
            v-if="Object.keys(upstreamOutputData).length > 0"
            class="rounded-lg border border-(--app-border) bg-(--app-card) py-1"
          >
            <template v-for="(val, key) in upstreamOutputData" :key="key">
              <TreeItem
                :name="key"
                :value="val"
                :path="key"
                :depth="0"
                @select="onSelectUpstreamPath"
              />
            </template>
          </div>
          <div
            v-else
            class="rounded-lg border border-dashed border-(--app-border) p-3 text-center"
          >
            <p class="text-[11px] text-(--app-text-muted)">
              请先运行一次上游节点，执行后可查看数据树
            </p>
            <p class="mt-1 text-[10px] text-(--app-text-muted)">
              可用字段：<span class="text-(--app-text-primary)">{{ mainPortFields.join(', ') }}</span>
            </p>
          </div>
        </div>
      </section>

    </template>
  </div>
</template>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- TreeItem — 递归数据树节点 -->
<script lang="ts">
import { defineComponent, h, ref, computed } from 'vue'

export const TreeItem = defineComponent({
  name: 'TreeItem',
  props: {
    name: { type: String, required: true },
    value: null,
    path: { type: String, required: true },
    depth: { type: Number, required: true },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const _open = ref(false)

    const expandable = computed(() => {
      const v = props.value
      if (v === null || v === undefined) return false
      if (Array.isArray(v)) return (v as unknown[]).length > 0
      return typeof v === 'object' && Object.keys(v as object).length > 0
    })

    function toggleLocal(): void {
      if (expandable.value) {
        _open.value = !_open.value
      } else {
        emit('select', props.path)
      }
    }

    function getChildren(): Array<{ key: string; val: unknown }> {
      const v = props.value
      if (Array.isArray(v)) return (v as unknown[]).map((item, i) => ({ key: `[${i}]`, val: item }))
      if (typeof v === 'object' && v !== null) {
        return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({ key: k, val }))
      }
      return []
    }

    function leafLabel(): string {
      const v = props.value
      if (typeof v === 'string') return `"${v}"`
      if (typeof v === 'boolean') return v ? 'true' : 'false'
      if (typeof v === 'number') return String(v)
      if (v === null) return 'null'
      return String(v ?? '')
    }

    const indent = computed(() => (props.depth ?? 0) * 14)

    return () => {
      const children = expandable.value && _open.value ? getChildren() : []
      return h('div', {}, [
        h(
          'div',
          {
            class: 'flex items-center gap-1 cursor-pointer px-2 py-[2px] text-[11px] hover:bg-black/5 select-none',
            style: { paddingLeft: `${8 + indent.value}px` },
            onClick: toggleLocal,
          },
          [
            expandable.value
              ? h('span', { class: 'text-[10px] w-3 shrink-0 text-(--app-text-muted)' }, _open.value ? '▾' : '▸')
              : h('span', { class: 'text-[10px] w-3 shrink-0 text-(--app-text-muted)' }, '·'),
            h('span', { class: !expandable.value ? 'text-(--app-text-secondary)' : 'text-(--app-text-primary) font-medium' }, props.name),
            !expandable.value
              ? h('span', { class: 'text-(--app-text-muted) truncate ml-1' }, leafLabel())
              : null,
          ],
        ),
        ...children.map((child) =>
          h(TreeItem, {
            key: props.path + '.' + child.key,
            name: child.key,
            value: child.val,
            path: props.path + '.' + child.key.replace(/^\[(\d+)\]$/, '[$1]'),
            depth: props.depth + 1,
            onSelect: (p: string) => emit('select', p),
          }),
        ),
      ])
    }
  },
})
</script>
