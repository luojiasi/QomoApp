<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInspectorPanel, type InspectedEntity } from '../../composables/useInspectorPanel'

const props = defineProps<{
  entities?: InspectedEntity[]
}>()

const emit = defineEmits<{
  'update': [field: string, value: number | boolean | string, entityId?: string]
}>()

const { activeSection } = useInspectorPanel()

// 折叠状态：多选时每个实体可折叠
const collapsed = ref<Set<string>>(new Set())

function toggleCollapse(id: string) {
  if (collapsed.value.has(id)) collapsed.value.delete(id)
  else collapsed.value.add(id)
  collapsed.value = new Set(collapsed.value) // 触发响应式
}

function isCollapsed(id: string) {
  return collapsed.value.has(id)
}

const count = computed(() => props.entities?.length ?? 0)
</script>

<template>
  <div class="inspector-panel">
    <div class="panel-header">
      属性
      <span v-if="count > 1" class="multi-badge">{{ count }} 个实体</span>
    </div>
    <div class="panel-body">
      <div v-if="!entities || entities.length === 0" class="empty-hint">选择实体以编辑属性</div>

      <template v-else>
        <!-- ── 多选时每个实体一张卡片 ── -->
        <div
          v-for="entity in entities"
          :key="entity.id"
          class="entity-card"
        >
          <!-- 卡片头 -->
          <div class="card-header" @click="count > 1 && toggleCollapse(entity.id)">
            <span class="card-kind">{{ entity.kind }}</span>
            <span class="card-id">{{ entity.id.slice(0, 8) }}</span>
            <span v-if="count > 1" class="card-toggle">{{ isCollapsed(entity.id) ? '▶' : '▼' }}</span>
          </div>

          <div v-if="count === 1 || !isCollapsed(entity.id)" class="card-body">
            <!-- ═══ 开口方向（共用到所有实体） ═══ -->
            <div class="section-label">开口方向</div>
            <div class="openside-row">
              <button
                class="side-btn"
                :class="{ active: entity.openSide === 'LEFT' }"
                @click="emit('update', 'openSide', 'LEFT', entity.id)"
              >
                <span class="side-arrow">←</span> 左开口
              </button>
              <button
                class="side-btn"
                :class="{ active: entity.openSide === 'RIGHT' }"
                @click="emit('update', 'openSide', 'RIGHT', entity.id)"
              >
                右开口 <span class="side-arrow">→</span>
              </button>
            </div>

            <!-- ── 几何参数（按实体类型） ── -->
            <div class="section-label">几何参数</div>

            <template v-if="entity.kind === 'LINE'">
              <label class="field"><span>起点 X</span>
                <input type="number" :value="entity.start.X" step="1"
                  @input="emit('update', 'start.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>起点 Y</span>
                <input type="number" :value="entity.start.Y" step="1"
                  @input="emit('update', 'start.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>终点 X</span>
                <input type="number" :value="entity.end.X" step="1"
                  @input="emit('update', 'end.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>终点 Y</span>
                <input type="number" :value="entity.end.Y" step="1"
                  @input="emit('update', 'end.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
            </template>

            <template v-else-if="entity.kind === 'ARC'">
              <label class="field"><span>圆心 X</span>
                <input type="number" :value="entity.center.X" step="1"
                  @input="emit('update', 'center.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>圆心 Y</span>
                <input type="number" :value="entity.center.Y" step="1"
                  @input="emit('update', 'center.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>半径</span>
                <input type="number" :value="entity.radius" step="1" min="0.1"
                  @input="emit('update', 'radius', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>起始角 °</span>
                <input type="number" :value="entity.startAngle" step="1"
                  @input="emit('update', 'startAngle', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>终止角 °</span>
                <input type="number" :value="entity.endAngle" step="1"
                  @input="emit('update', 'endAngle', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
            </template>

            <template v-else-if="entity.kind === 'CIRCLE'">
              <label class="field"><span>圆心 X</span>
                <input type="number" :value="entity.center.X" step="1"
                  @input="emit('update', 'center.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>圆心 Y</span>
                <input type="number" :value="entity.center.Y" step="1"
                  @input="emit('update', 'center.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>半径</span>
                <input type="number" :value="entity.radius" step="1" min="0.1"
                  @input="emit('update', 'radius', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
            </template>

            <template v-else-if="entity.kind === 'ELLIPSE'">
              <label class="field"><span>圆心 X</span>
                <input type="number" :value="entity.center.X" step="1"
                  @input="emit('update', 'center.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>圆心 Y</span>
                <input type="number" :value="entity.center.Y" step="1"
                  @input="emit('update', 'center.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>长轴端点 X</span>
                <input type="number" :value="entity.majorAxisEnd.X" step="1"
                  @input="emit('update', 'majorAxisEnd.X', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>长轴端点 Y</span>
                <input type="number" :value="entity.majorAxisEnd.Y" step="1"
                  @input="emit('update', 'majorAxisEnd.Y', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>短轴比例</span>
                <input type="number" :value="entity.minorAxisRatio" step="0.01" min="0.01" max="1"
                  @input="emit('update', 'minorAxisRatio', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>起始角 °</span>
                <input type="number" :value="entity.startParamDeg" step="1"
                  @input="emit('update', 'startParamDeg', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>终止角 °</span>
                <input type="number" :value="entity.endParamDeg" step="1"
                  @input="emit('update', 'endParamDeg', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
            </template>

            <template v-else-if="entity.kind === 'POLYLINE'">
              <label class="field">
                <span>闭合</span>
                <input type="checkbox" :checked="entity.closed"
                  @change="emit('update', 'closed', ($event.target as HTMLInputElement).checked, entity.id)" />
              </label>
              <div class="field readonly">
                <span>顶点数</span>
                <span class="readonly-value">{{ entity.vertices.length }}</span>
              </div>
            </template>

            <template v-else-if="entity.kind === 'BEZIER'">
              <div class="field readonly">
                <span>控制点数</span>
                <span class="readonly-value">{{ entity.controlPoints.length }}</span>
              </div>
            </template>

            <!-- ── 挤出参数（共用到所有实体） ── -->
            <div class="section-label">挤出参数</div>
            <label class="field">
              <span>高度</span>
              <input type="number" :value="entity.height" step="0.1" min="0"
                @input="emit('update', 'height', +($event.target as HTMLInputElement).value, entity.id)" />
            </label>
            <label class="field">
              <span>开口尺寸</span>
              <input type="number" :value="entity.openSize" step="0.1" min="0"
                @input="emit('update', 'openSize', +($event.target as HTMLInputElement).value, entity.id)" />
            </label>
            <label class="field">
              <span>倾斜角度 °</span>
              <input type="number" :value="entity.tiltAngleDeg" step="0.5"
                @input="emit('update', 'tiltAngleDeg', +($event.target as HTMLInputElement).value, entity.id)" />
            </label>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.inspector-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d4d4d8;
  font-size: 13px;
}
.panel-header {
  padding: 8px 10px;
  border-bottom: 1px solid #27272a;
  font-weight: 500;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.multi-badge {
  font-size: 10px;
  font-weight: 600;
  color: #60a5fa;
  background: rgba(59,130,246,.12);
  padding: 2px 8px;
  border-radius: 10px;
}
.panel-body { flex: 1; overflow-y: auto; }
.empty-hint {
  padding: 24px 10px;
  text-align: center;
  color: #52525b;
  font-size: 12px;
}

/* ── 实体卡片 ── */
.entity-card {
  border-bottom: 1px solid #27272a;
}
.entity-card:last-child { border-bottom: none; }

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: default;
  user-select: none;
}
.card-header:hover { background: rgba(255,255,255,.02); }
.card-kind {
  font-size: 13px;
  font-weight: 600;
  color: #e4e4e7;
}
.card-id {
  font-size: 11px;
  color: #52525b;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}
.card-toggle {
  margin-left: auto;
  font-size: 9px;
  color: #52525b;
}
.card-body {
  padding: 0 10px 10px;
}

/* ── 开口方向按钮组 ── */
.openside-row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.side-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 500;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #71717a;
  cursor: pointer;
  transition: all .15s;
}
.side-btn:hover { background: #27272a; color: #d4d4d8; }
.side-btn.active {
  background: rgba(59,130,246,.15);
  border-color: #3b82f6;
  color: #60a5fa;
}
.side-arrow { font-size: 12px; }

/* ── 字段 ── */
.section-label {
  padding: 10px 0 4px;
  font-size: 11px;
  font-weight: 500;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-label:first-child { padding-top: 2px; }

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.field span { font-size: 12px; color: #a1a1aa; }
.field input[type="number"] {
  width: 72px;
  padding: 3px 6px;
  font-size: 12px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: right;
}
.field input[type="number"]:focus { outline: none; border-color: #3b82f6; }

.field input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
  cursor: pointer;
}

.field.readonly { cursor: default; }
.readonly-value {
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
}
</style>
