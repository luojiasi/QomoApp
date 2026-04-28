<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { NODE_TYPE_META, MOTION_API_ENDPOINTS } from '../../configs/selfProcessConfigs'
import type { NodeType } from '../../types/selfProcessTypes'
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
  <div v-if="node && meta" class="flow-node-config">
    <div class="config-header">
      <span class="config-icon">{{ meta.icon }}</span>
      <span class="config-title">{{ meta.label }} 设置</span>
      <span
        class="config-node-id"
        :style="{ color: meta.color }"
      >ID: {{ node.id.slice(0, 8) }}</span>
    </div>

    <div class="config-body">
      <!-- 基础属性 -->
      <div class="config-section">
        <div class="section-title">基础属性</div>
        <div class="config-grid">
          <label class="config-field">
            <span class="field-label">节点名称</span>
            <input
              v-model="node.label"
              class="field-input"
              placeholder="输入节点名称"
              @input="store.saveWorkflow()"
            />
          </label>
          <label class="config-field">
            <span class="field-label">描述</span>
            <input
              v-model="node.description"
              class="field-input"
              placeholder="节点描述"
              @input="store.saveWorkflow()"
            />
          </label>
        </div>
      </div>

      <!-- 类型特定配置 -->
      <div class="config-section">
        <div class="section-title">{{ meta.label }} 参数</div>

        <!-- Task 节点配置 -->
        <template v-if="node.type === 'task'">
          <div class="config-grid">
            <label class="config-field">
              <span class="field-label">后端 API</span>
              <select v-model="node.config.apiEndpoint" class="field-input" @change="store.saveWorkflow()">
                <option value="">-- 选择 API --</option>
                <option v-for="ep in MOTION_API_ENDPOINTS" :key="ep.endpoint" :value="ep.endpoint">
                  {{ ep.label }}
                </option>
              </select>
            </label>
            <label class="config-field" v-if="node.config.apiEndpoint">
              <span class="field-label">请求方式</span>
              <input v-model="node.config.apiMethod" class="field-input" readonly />
            </label>
            <label class="config-field">
              <span class="field-label">超时 (秒)</span>
              <input v-model.number="node.config.timeout" type="number" class="field-input" min="1" max="300" />
            </label>
            <label class="config-field">
              <span class="field-label">重试次数</span>
              <input v-model.number="node.config.retryCount" type="number" class="field-input" min="0" max="10" />
            </label>
          </div>
          <label class="config-field config-full" v-if="node.config.apiEndpoint">
            <span class="field-label">请求体 (JSON)</span>
            <textarea
              v-model="apiBodyText"
              class="field-textarea"
              rows="4"
              placeholder='{"key": "value"}'
              @input="onApiBodyInput"
            />
          </label>
        </template>

        <!-- Condition 节点配置 -->
        <template v-if="node.type === 'condition'">
          <div class="config-grid">
            <label class="config-field">
              <span class="field-label">运算符</span>
              <select v-model="node.config.operator" class="field-input" @change="store.saveWorkflow()">
                <option v-for="op in operators" :key="op.value" :value="op.value">
                  {{ op.label }}
                </option>
              </select>
            </label>
            <label class="config-field">
              <span class="field-label">比较值</span>
              <input v-model="node.config.compareValue" class="field-input" placeholder="输入比较值" />
            </label>
          </div>
        </template>

        <!-- Delay 节点配置 -->
        <template v-if="node.type === 'delay'">
          <div class="config-grid">
            <label class="config-field">
              <span class="field-label">等待类型</span>
              <select v-model="node.config.delayType" class="field-input" @change="store.saveWorkflow()">
                <option value="fixed">固定时间</option>
              </select>
            </label>
            <label class="config-field">
              <span class="field-label">等待秒数</span>
              <input v-model.number="node.config.fixedSeconds" type="number" class="field-input" min="0.1" step="0.5" />
            </label>
          </div>
        </template>

        <!-- Loop 节点配置 -->
        <template v-if="node.type === 'loop'">
          <div class="config-grid">
            <label class="config-field">
              <span class="field-label">循环次数</span>
              <input v-model.number="node.config.count" type="number" class="field-input" min="1" max="999" />
            </label>
          </div>
        </template>
      </div>

      <!-- 数据映射 -->
      <div class="config-section">
        <div class="section-title">输入数据映射</div>
        <p class="section-desc">配置节点的输入数据来自哪个上游节点的输出</p>
        <FlowDataMapping
          :node-id="node.id"
          :mappings="node.dataMappings"
          :node-type="node.type"
          @add="store.addDataMapping(node.id, { ...$event })"
          @remove="store.removeDataMapping(node.id, $event)"
        />
      </div>

      <!-- 跳转条件 -->
      <div v-if="skipConditionsVisible" class="config-section">
        <div class="section-title">条件跳转</div>
        <p class="section-desc">满足条件时跳转到指定节点</p>
        <FlowSkipCondition
          :node-id="node.id"
          :conditions="node.skipConditions"
          :nodes="store.currentWorkflow?.nodes ?? []"
          @add="store.addSkipCondition(node.id, { ...$event })"
          @remove="store.removeSkipCondition(node.id, $event)"
        />
      </div>

      <!-- 默认下一个节点 -->
      <div class="config-section">
        <div class="section-title">默认下一个节点</div>
        <label class="config-field">
          <select
            v-model="node.nextNodeId"
            class="field-input"
            @change="store.saveWorkflow()"
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
  <div v-else class="flow-node-config-empty">
    <p class="empty-text">点击画布上的节点进行配置</p>
  </div>
</template>

<style scoped>
.flow-node-config {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-card);
  overflow-y: auto;
  max-height: 400px;
}
.config-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  font-weight: 600;
  font-size: 14px;
}
.config-icon { font-size: 18px; }
.config-title { flex: 1; }
.config-node-id { font-size: 11px; font-weight: 400; }

.config-body { padding: 12px 16px; }
.config-section { margin-bottom: 16px; }
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 4px;
}
.section-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  margin-bottom: 8px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.config-full {
  grid-column: 1 / -1;
}
.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-label {
  font-size: 11px;
  color: var(--app-text-secondary);
  font-weight: 500;
}
.field-input {
  padding: 6px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 13px;
  outline: none;
}
.field-input:focus {
  border-color: #2563eb;
}
.field-textarea {
  padding: 6px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
  font-family: monospace;
}

.flow-node-config-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  border: 1px dashed var(--app-border);
  border-radius: 12px;
  background: var(--app-card-soft);
}
.empty-text {
  font-size: 13px;
  color: var(--app-text-muted);
}
</style>
