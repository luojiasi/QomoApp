<script setup lang="ts">
import { ref, computed } from 'vue'
import { type InspectedEntity } from '../../composables/useInspectorPanel'
import PointRow from '../../shares/PointRow.vue'

const props = defineProps<{
  entities?: InspectedEntity[]
}>()

const emit = defineEmits<{
  'update': [field: string, value: number | boolean | string | Record<string, unknown>[], entityId?: string]
}>()

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

import type { Point2D, BezierEntity, PolylineVertex, PolylineEntity, ExtrusionParams } from '../../commons/types'

type BezierInspectedEntity = BezierEntity & ExtrusionParams
type PolylineInspectedEntity = PolylineEntity & ExtrusionParams

function updateControlPoint(entity: BezierInspectedEntity, idx: number, axis: 'X' | 'Y', value: number) {
  const pts = entity.controlPoints.map((p: Point2D) => ({ ...p }))
  pts[idx] = { ...pts[idx], [axis]: value }
  emit('update', 'controlPoints', pts as unknown as Record<string, unknown>[], entity.id)
}

function addControlPoint(entity: BezierInspectedEntity) {
  const pts = entity.controlPoints.map((p: Point2D) => ({ ...p }))
  const last = pts[pts.length - 1] ?? { X: 0, Y: 0 }
  pts.push({ X: last.X + 10, Y: last.Y })
  emit('update', 'controlPoints', pts as unknown as Record<string, unknown>[], entity.id)
}

function removeControlPoint(entity: BezierInspectedEntity) {
  if (entity.controlPoints.length <= 2) return
  const pts = entity.controlPoints.slice(0, -1).map((p: Point2D) => ({ ...p }))
  emit('update', 'controlPoints', pts as unknown as Record<string, unknown>[], entity.id)
}

// ── POLYLINE 顶点编辑 ──

function updatePolyVertex(entity: PolylineInspectedEntity, idx: number, field: 'X' | 'Y' | 'bulge', value: number) {
  const verts: PolylineVertex[] = entity.vertices.map(v => ({ point: { ...v.point }, bulge: v.bulge }))
  if (field === 'bulge') {
    verts[idx].bulge = value
  } else {
    verts[idx].point[field] = value
  }
  emit('update', 'vertices', verts as unknown as Record<string, unknown>[], entity.id)
}

function addPolyVertex(entity: PolylineInspectedEntity) {
  const last = entity.vertices[entity.vertices.length - 1]
  const p = last ? { X: last.point.X + 10, Y: last.point.Y } : { X: 0, Y: 0 }
  const verts: PolylineVertex[] = [
    ...entity.vertices.map(v => ({ point: { ...v.point }, bulge: v.bulge })),
    { point: p, bulge: 0 },
  ]
  emit('update', 'vertices', verts as unknown as Record<string, unknown>[], entity.id)
}

function removePolyVertex(entity: PolylineInspectedEntity) {
  if (entity.vertices.length <= 2) return
  const verts = entity.vertices.slice(0, -1).map(v => ({ point: { ...v.point }, bulge: v.bulge }))
  emit('update', 'vertices', verts as unknown as Record<string, unknown>[], entity.id)
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
              <PointRow label="起点" :x="entity.start.X" :y="entity.start.Y"
                :entity-id="entity.id" x-field="start.X" y-field="start.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
              <PointRow label="终点" :x="entity.end.X" :y="entity.end.Y"
                :entity-id="entity.id" x-field="end.X" y-field="end.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
            </template>

            <template v-else-if="entity.kind === 'ARC'">
              <PointRow label="圆心" :x="entity.center.X" :y="entity.center.Y"
                :entity-id="entity.id" x-field="center.X" y-field="center.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
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
              <PointRow label="圆心" :x="entity.center.X" :y="entity.center.Y"
                :entity-id="entity.id" x-field="center.X" y-field="center.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
              <label class="field"><span>半径</span>
                <input type="number" :value="entity.radius" step="1" min="0.1"
                  @input="emit('update', 'radius', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
            </template>

            <template v-else-if="entity.kind === 'ELLIPSE'">
              <PointRow label="圆心" :x="entity.center.X" :y="entity.center.Y"
                :entity-id="entity.id" x-field="center.X" y-field="center.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
              <PointRow label="长轴端点" :x="entity.majorAxisEnd.X" :y="entity.majorAxisEnd.Y"
                :entity-id="entity.id" x-field="majorAxisEnd.X" y-field="majorAxisEnd.Y"
                @update="(f, v, id) => emit('update', f, v, id)" />
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
              <div class="section-label">顶点 ({{ entity.vertices.length }})</div>
              <div v-for="(vt, idx) in entity.vertices" :key="idx" class="poly-vertex-row">
                <PointRow
                  :label="String(idx + 1)" compact :step="0.1"
                  :x="vt.point.X" :y="vt.point.Y"
                  :entity-id="entity.id"
                  x-field="X" y-field="Y"
                  @update="(f, v) => updatePolyVertex(entity as PolylineInspectedEntity, idx, f as 'X' | 'Y', v)"
                />
                <label class="poly-bulge-field">
                  <span>凸度：</span>
                  <input type="number" :value="vt.bulge" step="0.01"
                    @input="updatePolyVertex(entity as PolylineInspectedEntity, idx, 'bulge', +($event.target as HTMLInputElement).value)" />
                </label>
              </div>
              <div class="bezier-actions">
                <button class="action-btn" @click="addPolyVertex(entity as PolylineInspectedEntity)">+ 添加</button>
                <button class="action-btn"
                  :disabled="entity.vertices.length <= 2"
                  @click="removePolyVertex(entity as PolylineInspectedEntity)"
                >- 删除</button>
              </div>
            </template>

            <template v-else-if="entity.kind === 'BEZIER'">
              <div class="section-label">控制点 ({{ entity.controlPoints.length }})</div>
              <PointRow v-for="(pt, idx) in entity.controlPoints" :key="idx"
                :label="String(idx + 1)" compact :step="0.1"
                :x="pt.X" :y="pt.Y" :entity-id="entity.id"
                x-field="X" y-field="Y"
                @update="(f, v) => updateControlPoint(entity, idx, f as 'X' | 'Y', v)" />
              <div class="bezier-actions">
                <button class="action-btn" @click="addControlPoint(entity)">+ 添加</button>
                <button class="action-btn"
                :disabled="entity.controlPoints.length <= 2"
                @click="removeControlPoint(entity)"
                >- 删除</button>
              </div>
            </template>

            <!-- ── 钻石参数（任何实体有 diamondParams 时显示） ── -->
            <template v-if="entity.diamondParams">
              <div class="section-label">钻石参数</div>
              <label class="field"><span>长 (L)</span>
                <input type="number" :value="entity.diamondParams.L" step="0.01" min="0.1"
                  @input="emit('update', 'diamondParams.L', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>宽 (W)</span>
                <input type="number" :value="entity.diamondParams.W" step="0.01" min="0.1"
                  @input="emit('update', 'diamondParams.W', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>深度 %</span>
                <input type="number" :value="entity.diamondParams.Depth" step="0.1" min="0" max="100"
                  @input="emit('update', 'diamondParams.Depth', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>亭部 %</span>
                <input type="number" :value="entity.diamondParams.Pavilion" step="0.1" min="0" max="100"
                  @input="emit('update', 'diamondParams.Pavilion', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>冠部 %</span>
                <input type="number" :value="entity.diamondParams.Crown" step="0.1" min="0" max="100"
                  @input="emit('update', 'diamondParams.Crown', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>腰部 %</span>
                <input type="number" :value="entity.diamondParams.Girdle" step="0.1" min="0" max="100"
                  @input="emit('update', 'diamondParams.Girdle', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
              <label class="field"><span>台面 %</span>
                <input type="number" :value="entity.diamondParams.Table" step="0.1" min="0" max="100"
                  @input="emit('update', 'diamondParams.Table', +($event.target as HTMLInputElement).value, entity.id)" />
              </label>
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
  color: #d4d4d8;
  font-size: 12px;
}

/* ── 贝塞尔控制点 ── */

.poly-vertex-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.poly-bulge-field {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.poly-bulge-field span {
  font-size: 10px;
  color: #52525b;
}
.poly-bulge-field input {
  width: 60px;
  padding: 2px 4px;
  font-size: 11px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #d4d4d8;
  text-align: right;
  outline: none;
}
.poly-bulge-field input:focus { border-color: #3b82f6; }

.bezier-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.action-btn {
  padding: 2px 8px;
  font-size: 11px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all .15s;
}
.action-btn:hover:not(:disabled) { background: #27272a; color: #d4d4d8; }
.action-btn:disabled { 
  opacity: 0.3; 
  cursor: not-allowed;
  background: #18181b;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
}
</style>