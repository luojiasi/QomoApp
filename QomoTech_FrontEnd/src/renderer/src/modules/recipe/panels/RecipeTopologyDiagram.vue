<script setup lang="ts">
import { computed } from 'vue'
import type { RecipeManagerState } from '../recipeTypes'

const props = defineProps<{
  state: RecipeManagerState
}>()

type NodeKind =
  | 'main'
  | 'blackening'
  | 'machining'
  | 'laserPower'
  | 'horizontalFormula'
  | 'verticalFormula'
  | 'missing'

interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  sub?: string
  cx: number
  cy: number
  w: number
  h: number
}

interface GraphEdge {
  from: string
  to: string
}

const VIEW_W = 920
const VIEW_H = 340

/** 仅保留描边色区分类型；填充统一用 var(--app-card-soft)，与明暗主题一致 */
const kindMeta: Record<NodeKind, { stroke: string; tag: string }> = {
  main: { stroke: '#2563eb', tag: '主配方' },
  blackening: { stroke: '#7c3aed', tag: '扫黑' },
  machining: { stroke: '#059669', tag: '加工' },
  laserPower: { stroke: '#ea580c', tag: '激光功率' },
  horizontalFormula: { stroke: '#ca8a04', tag: '水平工艺' },
  verticalFormula: { stroke: '#db2777', tag: '垂直工艺' },
  missing: { stroke: '#64748b', tag: '缺失' }
}

const diagram = computed(() => {
  const state = props.state
  const main =
    state.mainRecipes.find((r) => r.id === state.selectedMainRecipeId) ?? state.mainRecipes[0] ?? null

  if (!main) {
    return {
      nodes: [] as GraphNode[],
      edges: [] as GraphEdge[],
      legend: kindMeta,
      emptyMessage: '暂无主配方数据',
      mainName: ''
    }
  }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeKeys = new Set<string>()
  const nodeByKey = new Map<string, GraphNode>()

  function pushEdge(from: string, to: string): void {
    const k = `${from}|${to}`
    if (edgeKeys.has(k)) return
    edgeKeys.add(k)
    edges.push({ from, to })
  }

  const addNode = (n: GraphNode): GraphNode => {
    if (!nodeByKey.has(n.id)) {
      nodeByKey.set(n.id, n)
      nodes.push(n)
    }
    return nodeByKey.get(n.id)!
  }

  const mainId = `main:${main.id}`
  addNode({
    id: mainId,
    kind: 'main',
    label: main.name || '主配方',
    sub: main.code,
    cx: VIEW_W / 2,
    cy: 38,
    w: 224,
    h: 48
  })

  const procY = 124
  const procCenters = [VIEW_W / 2 - 200, VIEW_W / 2 + 200]

  const b = state.blackeningRecipes.find((r) => r.id === main.blackeningRecipeId)
  const m = state.machiningRecipes.find((r) => r.id === main.machiningRecipeId)

  const bKey = b ? `blackening:${b.id}` : 'blackening:missing'
  const mKey = m ? `machining:${m.id}` : 'machining:missing'

  addNode({
    id: bKey,
    kind: b ? 'blackening' : 'missing',
    label: b?.name ?? '扫黑（未绑定）',
    sub: b?.code,
    cx: procCenters[0],
    cy: procY,
    w: 172,
    h: 44
  })
  addNode({
    id: mKey,
    kind: m ? 'machining' : 'missing',
    label: m?.name ?? '加工（未绑定）',
    sub: m?.code,
    cx: procCenters[1],
    cy: procY,
    w: 172,
    h: 44
  })

  pushEdge(mainId, bKey)
  pushEdge(mainId, mKey)

  function laserNode(lpId: string): string {
    const lp = state.laserPowerRecipes.find((r) => r.id === lpId)
    const id = `laser:${lpId}`
    addNode({
      id,
      kind: lp ? 'laserPower' : 'missing',
      label: lp?.name ?? `激光（未找到 ${lpId}）`,
      sub: lp?.code,
      cx: 0,
      cy: 0,
      w: 192,
      h: 42
    })
    return id
  }

  function horizontalNode(hId: string): string {
    const h = state.horizontalFormulaRecipes.find((r) => r.id === hId)
    const id = `horizontal:${hId}`
    addNode({
      id,
      kind: h ? 'horizontalFormula' : 'missing',
      label: h?.name ?? `水平（未找到 ${hId}）`,
      sub: h?.code,
      cx: 0,
      cy: 0,
      w: 192,
      h: 42
    })
    return id
  }

  function verticalNode(vId: string): string {
    const v = state.verticalFormulaRecipes.find((r) => r.id === vId)
    const id = `vertical:${vId}`
    addNode({
      id,
      kind: v ? 'verticalFormula' : 'missing',
      label: v?.name ?? `垂直（未找到 ${vId}）`,
      sub: v?.code,
      cx: 0,
      cy: 0,
      w: 192,
      h: 42
    })
    return id
  }

  if (b?.laserPowerRecipeId) {
    const tid = laserNode(b.laserPowerRecipeId)
    pushEdge(bKey, tid)
  }

  if (m) {
    if (m.laserPowerRecipeId) {
      const tid = laserNode(m.laserPowerRecipeId)
      pushEdge(mKey, tid)
    }
    if (m.horizontalFormulaId) {
      const tid = horizontalNode(m.horizontalFormulaId)
      pushEdge(mKey, tid)
    }
    if (m.verticalFormulaId) {
      const tid = verticalNode(m.verticalFormulaId)
      pushEdge(mKey, tid)
    }
  }

  const resY = 258
  const resourceNodes = nodes.filter(
    (n) =>
      n.id.startsWith('laser:') ||
      n.id.startsWith('horizontal:') ||
      n.id.startsWith('vertical:')
  )

  const order = (k: NodeKind): number =>
    k === 'laserPower' ? 0 : k === 'horizontalFormula' ? 1 : k === 'verticalFormula' ? 2 : 3
  resourceNodes.sort((a, b) => {
    const d = order(a.kind) - order(b.kind)
    return d !== 0 ? d : a.label.localeCompare(b.label, 'zh-CN')
  })

  const n = resourceNodes.length
  const gap = 14
  const rw = 192
  if (n > 0) {
    const total = n * rw + (n - 1) * gap
    let left = (VIEW_W - total) / 2 + rw / 2
    for (let i = 0; i < n; i++) {
      resourceNodes[i].cx = left + i * (rw + gap)
      resourceNodes[i].cy = resY
    }
  }

  return {
    nodes,
    edges,
    legend: kindMeta,
    emptyMessage: null as string | null,
    mainName: main.name ?? ''
  }
})

function nodeBox(n: GraphNode): { x: number; y: number } {
  return { x: n.cx - n.w / 2, y: n.cy - n.h / 2 }
}

function edgePath(from: GraphNode, to: GraphNode): string {
  const a = nodeBox(from)
  const b = nodeBox(to)
  const x1 = from.cx
  const y1 = a.y + from.h
  const x2 = to.cx
  const y2 = b.y
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
}
</script>

<template>
  <div class="w-full overflow-x-auto rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
    <p v-if="diagram.emptyMessage" class="app-text-secondary py-8 text-center text-sm">
      {{ diagram.emptyMessage }}
    </p>
    <template v-else>
      <svg
        class="mx-auto block h-auto max-w-full text-[11px]"
        :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
        role="img"
        :aria-label="`主配方 ${diagram.mainName} 拓扑关系图`"
      >
        <!-- 与外层容器一致，避免 rect 未着色时透出 SVG 默认黑底 -->
        <rect width="100%" height="100%" fill="var(--app-card-soft)" />

        <defs>
          <marker
            id="recipe-topo-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path fill="var(--app-text-muted)" d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>

        <g v-for="edge in diagram.edges" :key="`${edge.from}-${edge.to}`">
          <path
            v-if="diagram.nodes.find((n) => n.id === edge.from) && diagram.nodes.find((n) => n.id === edge.to)"
            :d="
              edgePath(
                diagram.nodes.find((n) => n.id === edge.from)!,
                diagram.nodes.find((n) => n.id === edge.to)!
              )
            "
            fill="none"
            stroke="var(--app-text-muted)"
            stroke-width="1.25"
            marker-end="url(#recipe-topo-arrow)"
          />
        </g>

        <g v-for="n in diagram.nodes" :key="n.id">
          <rect
            :x="nodeBox(n).x"
            :y="nodeBox(n).y"
            :width="n.w"
            :height="n.h"
            :rx="10"
            fill="var(--app-card)"
            :stroke="diagram.legend[n.kind].stroke"
            stroke-width="1.5"
          />
          <text
            :x="n.cx"
            :y="nodeBox(n).y + 18"
            text-anchor="middle"
            fill="var(--app-text-muted)"
            style="font-size: 11px; font-weight: 600"
          >
            {{ diagram.legend[n.kind].tag }}
          </text>
          <text
            :x="n.cx"
            :y="nodeBox(n).y + 34"
            text-anchor="middle"
            fill="var(--app-text-primary)"
            style="font-size: 12px"
          >
            {{ n.label.length > 14 ? `${n.label.slice(0, 14)}…` : n.label }}
          </text>
        </g>
      </svg>

      <div
        class="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-(--app-border) pt-3 text-[11px] text-(--app-text-secondary)"
      >
        <span v-for="(meta, key) in diagram.legend" :key="key" class="inline-flex items-center gap-1.5">
          <span
            class="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border bg-(--app-card)"
            :style="{ borderColor: meta.stroke }"
          />
          {{ meta.tag }}
        </span>
      </div>
    </template>
  </div>
</template>
