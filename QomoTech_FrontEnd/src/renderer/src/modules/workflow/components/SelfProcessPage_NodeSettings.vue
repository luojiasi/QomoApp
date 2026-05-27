<script setup lang="ts">
// SelfProcessPage_NodeSettings.vue — 右侧节点参数配置面板
//
// 显示当前选中节点的可编辑参数。
// 节点蓝图（NodeTypeDef）中定义了哪些参数，这里动态渲染对应表单控件。
import { computed } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'
import AppToggle from '../UI/AppToggle.vue'
import AppSelect from '../UI/AppSelect.vue'
import AppInput from '../UI/AppInput.vue'

const store = useWorkflowStore()

const node = computed(() => store.selectedNode)
const def  = computed(() => node.value ? (NODE_REGISTRY[node.value.type] ?? null) : null)
const style = computed(() => def.value ? NODE_CATEGORY_STYLES[def.value.category] : null)

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

                <!-- string / number / expression / json → 文本输入 -->
                <AppInput
                  v-else
                  :model-value="String(node.params[param.name] ?? param.default ?? '')"
                  :placeholder="param.placeholder ?? param.displayName"
                  :type="param.type === 'number' ? 'number' : 'text'"
                  @update:model-value="
                    setParam(param.name, param.type === 'number' ? Number($event) : $event)
                  "
                />

                <p v-if="param.description && param.type !== 'boolean'" class="mt-0.5 text-[10px] text-(--app-text-muted)">
                  {{ param.description }}
                </p>
              </div>
            </template>
          </div>
        </section>

        <!-- 蓝图未注册时的提示 -->
        <div v-else-if="!def" class="rounded-lg border border-dashed border-(--app-border) p-4 text-center">
          <p class="text-[11px] text-(--app-text-muted)">节点类型 <code class="font-mono">{{ node.type }}</code> 尚未注册蓝图</p>
        </div>

      </div>
    </template>
  </div>
</template>
