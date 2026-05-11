<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useControllerSettingsStore } from '../../stores/controllerSettingsStore'

interface ApiDef {
  label: string
  method: 'GET' | 'POST'
  path: string
  defaultBody?: any
  queryParams?: string
  desc?: string
}

interface ApiGroup {
  name: string
  apis: ApiDef[]
}

// ---- result per API index ----
type ApiResult = { ok: boolean; text: string; ts: number } | null
const results = ref<Record<string, ApiResult>>({})

// ---- collapsed sections ----
const collapsed = ref<Record<string, boolean>>({})

// ---- param editor expanded ----
const paramsOpen = ref<Record<string, boolean>>({})

// ---- loading ----
const loading = ref<Record<string, boolean>>({})

// ---- user-edited values ----
const editedPaths = reactive<Record<string, string>>({})
const editedBodies = reactive<Record<string, string>>({})
const editedQueries = reactive<Record<string, string>>({})

const store = useControllerSettingsStore()

const ip = computed(() => store.controllerSettings.communication.controller_ip)

function initEdited(key: string, def: ApiDef): void {
  if (!(key in editedPaths)) {
    editedPaths[key] = def.path
  }
  if (!(key in editedBodies)) {
    editedBodies[key] = def.defaultBody !== undefined
      ? JSON.stringify(def.defaultBody, null, 2)
      : (def.method === 'POST' ? '{}' : '')
  }
  if (!(key in editedQueries)) {
    editedQueries[key] = def.queryParams ?? ''
  }
}

// ===========================================================================
// API definitions — body defaults match backend Pydantic models
// ===========================================================================
const groups: ApiGroup[] = [
  {
    name: 'Motion — 生命周期',
    apis: [
      { label: '连接', method: 'POST', path: '/api/motion/connect', defaultBody: { ip: '192.168.0.11' } },
      { label: '断开', method: 'POST', path: '/api/motion/disconnect' },
      { label: '复位', method: 'POST', path: '/api/motion/reset' },
    ],
  },
  {
    name: 'Motion — 状态查询',
    apis: [
      { label: '整机状态', method: 'GET', path: '/api/motion/state' },
      { label: '全部轴状态', method: 'GET', path: '/api/motion/axes' },
      { label: 'DPOS(轴)', method: 'GET', path: '/api/motion/dpos/X' },
      { label: 'MPOS(轴)', method: 'GET', path: '/api/motion/mpos/X' },
      { label: 'IDLE(轴)', method: 'GET', path: '/api/motion/idle/X' },
      { label: 'XY位置', method: 'GET', path: '/api/motion/position/xy' },
      { label: 'Z位置', method: 'GET', path: '/api/motion/position/z' },
    ],
  },
  {
    name: 'Motion — 单轴运动',
    apis: [
      { label: '回零', method: 'POST', path: '/api/motion/home', defaultBody: { axes: ['X', 'Y', 'Z'] } },
      { label: '点动', method: 'POST', path: '/api/motion/jog', defaultBody: { axis: 'X', direction: 1, speed: 20 } },
      { label: '停止点动', method: 'POST', path: '/api/motion/jog/stop', defaultBody: { axis: 'X' } },
      { label: '绝对运动', method: 'POST', path: '/api/motion/move/abs', defaultBody: { axis: 'X', position: 50, speed: 20 }, desc: '⚠ 注意运动范围' },
      { label: '相对运动', method: 'POST', path: '/api/motion/move/rel', defaultBody: { axis: 'X', position: 10, speed: 20 }, desc: '⚠ 注意运动范围' },
      { label: '绝对运动+速度', method: 'POST', path: '/api/motion/move/abs-with-speed', defaultBody: { axis: 'X', position: 50, speed: 20 }, desc: '⚠ 注意运动范围' },
    ],
  },
  {
    name: 'Motion — 多轴插补',
    apis: [
      { label: '直线插补', method: 'POST', path: '/api/motion/move/linear', defaultBody: { axes: ['X', 'Y'], positions: [10, 20], speed: 20, relative: false } },
      { label: '圆心圆弧', method: 'POST', path: '/api/motion/move/circle', defaultBody: { axes: ['X', 'Y'], end1: 10, end2: 0, center1: 0, center2: 10, direction: 'ccw', speed: 20 } },
      { label: '三点圆弧', method: 'POST', path: '/api/motion/move/circle3p', defaultBody: { axes: ['X', 'Y'], mid1: 5, mid2: 10, end1: 10, end2: 0, speed: 20 } },
      { label: '螺旋插补', method: 'POST', path: '/api/motion/move/spiral', defaultBody: { axes: ['X', 'Y', 'Z'], center1: 0, center2: 10, circles: 1, pitch: 5, third_distance: 5, speed: 20 } },
      { label: '五轴联动', method: 'POST', path: '/api/motion/move/5axis', defaultBody: { positions: [10, 20, 5, 30, 0], speed: 20, relative: false } },
      { label: '3+2定向加工', method: 'POST', path: '/api/motion/move/3p2', defaultBody: { u_angle: 45, r_angle: 90, xyz_path: [[10, 20, 5]] } },
      { label: '连续插补XY', method: 'POST', path: '/api/motion/move/contour-xy', defaultBody: { path: [{ x: 0, y: 0, speed: 20 }, { x: 10, y: 10, speed: 20 }], speed: 20 } },
      { label: '连续插补通用', method: 'POST', path: '/api/motion/move/contour', defaultBody: { axes: ['X', 'Y'], path: [{ x: 0, y: 0, speed: 20 }, { x: 10, y: 10, speed: 20 }] } },
    ],
  },
  {
    name: 'Motion — MERGE / 暂停 / 停止',
    apis: [
      { label: '启用MERGE', method: 'POST', path: '/api/motion/merge/enable', defaultBody: { axis: 'X' } },
      { label: '关闭MERGE', method: 'POST', path: '/api/motion/merge/disable', defaultBody: { axis: 'X' } },
      { label: '暂停', method: 'POST', path: '/api/motion/pause' },
      { label: '继续', method: 'POST', path: '/api/motion/resume' },
      { label: '减速停止', method: 'POST', path: '/api/motion/stop' },
      { label: '急停', method: 'POST', path: '/api/motion/estop' },
    ],
  },
  {
    name: 'Motion — U/R 轴旋转',
    apis: [
      { label: 'U轴旋转(params)', method: 'POST', path: '/api/motion/u/rotate-by-params', defaultBody: { params: { 旋转角度: 90, 旋转速度: 10, 旋转方向: '顺时针', 运动模式: 'relative' } } },
      { label: 'U轴旋转(angle)', method: 'POST', path: '/api/motion/u/rotate-angle', defaultBody: { angle: 90 } },
      { label: 'U轴到达角度?', method: 'GET', path: '/api/motion/u/at-angle', queryParams: 'angle=90&tolerance=0.001' },
      { label: 'R轴旋转(turns)', method: 'POST', path: '/api/motion/r/rotate-turns', defaultBody: { params: { 旋转圈数: 1, 旋转速度: 10, 旋转方向: '顺时针', 运动模式: 'relative' } } },
      { label: 'R轴持续旋转', method: 'POST', path: '/api/motion/r/rotate-cont', defaultBody: { speed: 10 } },
      { label: 'R轴位置', method: 'GET', path: '/api/motion/r/position' },
    ],
  },
  {
    name: 'Motion — IO',
    apis: [
      { label: '设置OUT', method: 'POST', path: '/api/motion/io/output', defaultBody: { io: 0, value: true } },
      { label: '读单个OUT', method: 'GET', path: '/api/motion/io/output/0' },
      { label: '批量读OUT', method: 'GET', path: '/api/motion/io/output', queryParams: 'start=0&end=8' },
      { label: '读单个IN', method: 'GET', path: '/api/motion/io/input/0' },
      { label: '批量读IN', method: 'GET', path: '/api/motion/io/input', queryParams: 'start=0&end=8' },
    ],
  },
  {
    name: 'Motion — 轴参数',
    apis: [
      { label: '写入轴参数', method: 'POST', path: '/api/motion/axis/params', defaultBody: { axis: 'X', fields: { speed: 20 } } },
      { label: '批量轴参数', method: 'POST', path: '/api/motion/axis/params/batch', defaultBody: { table: { X: { speed: 20 }, Y: { speed: 30 } } } },
      { label: '重新下发所有轴', method: 'POST', path: '/api/motion/axis/params/reload' },
      { label: '反向间隙', method: 'POST', path: '/api/motion/axis/backlash', defaultBody: { axis: 'X', enable: true, distance: 1000, speed: 50, accel: 100 } },
      { label: '软限位', method: 'POST', path: '/api/motion/axis/soft-limit', defaultBody: { axis: 'X', max: 1000, min: -1000 } },
      { label: '清除轴错误', method: 'POST', path: '/api/motion/axis/clear-error', defaultBody: { axis: 'X' } },
      { label: '轴位置清零', method: 'POST', path: '/api/motion/axis/zero', defaultBody: { axis: 'X' } },
    ],
  },
  {
    name: 'Motion — 工具',
    apis: [
      { label: '等待静止', method: 'POST', path: '/api/motion/wait-idle', defaultBody: { axis: 'X', timeout_s: 10 } },
      { label: '执行命令', method: 'POST', path: '/api/motion/cmd', defaultBody: { command: '?*set' }, desc: 'ZAux_Execute 透传' },
    ],
  },
  {
    name: 'Program 程序运行',
    apis: [
      { label: '启动程序', method: 'POST', path: '/api/startProgram', defaultBody: { recipe_payload: {}, entities: [] } },
      { label: '程序状态', method: 'GET', path: '/api/startProgram/status' },
      { label: '程序控制', method: 'POST', path: '/api/startProgram/control', defaultBody: { action: 'pause' }, desc: 'pause/resume/reset/estop/skip' },
    ],
  },
  {
    name: 'Camera 相机',
    apis: [
      { label: '枚举设备', method: 'GET', path: '/api/camera/devices' },
      { label: '连接相机', method: 'POST', path: '/api/camera/connect', defaultBody: { index: 0 } },
      { label: '断开相机', method: 'POST', path: '/api/camera/disconnect' },
      { label: '相机状态', method: 'GET', path: '/api/camera/status' },
      { label: '引导参数', method: 'POST', path: '/api/camera/bootstrap-settings', defaultBody: { auto_exposure: true } },
      { label: '抓取单帧', method: 'GET', path: '/api/camera/frame', queryParams: 'timeout_ms=1000&quality=90', desc: '返回 JPEG 字节' },
      { label: '曝光参数', method: 'POST', path: '/api/camera/params/exposure', defaultBody: { exposure_time: 10000 } },
      { label: '帧率参数', method: 'POST', path: '/api/camera/params/frame-speed', defaultBody: { speed_level: 2 } },
      { label: '镜像参数', method: 'POST', path: '/api/camera/params/mirror', defaultBody: { horizontal: false, vertical: false } },
      { label: '白平衡', method: 'POST', path: '/api/camera/params/white-balance', defaultBody: { auto_white_balance: true } },
    ],
  },
  {
    name: 'RS232 串口',
    apis: [
      { label: '枚举串口', method: 'GET', path: '/api/rs232/ports' },
      { label: '串口状态', method: 'GET', path: '/api/rs232/status' },
      { label: '接收缓冲', method: 'GET', path: '/api/rs232/buffer', queryParams: 'clear=false' },
    ],
  },
  {
    name: 'System / Product4P',
    apis: [
      { label: '激光参数', method: 'POST', path: '/api/laser/apply', defaultBody: { laserPower: 80 } },
      { label: '关机', method: 'POST', path: '/api/shutdown', desc: '⚠ 关闭后端' },
      { label: '4P中心补偿(GET)', method: 'GET', path: '/api/product4p/center-rotation' },
      { label: '4P中心补偿(POST)', method: 'POST', path: '/api/product4p/center-rotation', defaultBody: { Xoffset: 0, Yoffset: 0, Zoffset: 0 } },
    ],
  },
]

// ---- build flat indexed list ----
let idx = 0
const flatApis = groups.flatMap((g) =>
  g.apis.map((a) => {
    const key = String(idx++)
    initEdited(key, a)
    return { key, group: g.name, ...a }
  })
)

function getKey(api: ApiDef): string {
  return String(flatApis.findIndex((fa) => fa.path === api.path && fa.label === api.label))
}

function hasParams(api: ApiDef): boolean {
  return api.method === 'POST' || (api.method === 'GET' && !!api.queryParams)
}

async function execApi(key: string): Promise<void> {
  const def = flatApis.find((fa) => fa.key === key)
  if (!def) return

  loading.value[key] = true
  results.value[key] = null
  const ts = Date.now()

  const path = editedPaths[key] ?? def.path
  const query = editedQueries[key] ?? ''
  const fullUrl = query ? `${path}?${query}` : path

  try {
    let res: Response
    if (def.method === 'GET') {
      res = await fetch(fullUrl)
    } else {
      let bodyStr = (editedBodies[key] ?? '{}').trim()
      if (!bodyStr) bodyStr = '{}'
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      })
    }
    const text = await res.text()
    const ok = res.status >= 200 && res.status < 300
    try {
      const json = JSON.parse(text)
      results.value[key] = { ok, text: JSON.stringify(json, null, 2), ts }
    } catch {
      results.value[key] = { ok, text, ts }
    }
  } catch (e: any) {
    results.value[key] = { ok: false, text: `Fetch error: ${e?.message ?? String(e)}`, ts }
  } finally {
    loading.value[key] = false
  }
}

function batchExec(apis: ApiDef[]): void {
  for (const api of apis) {
    const key = getKey(api)
    execApi(key)
  }
}

function methodClass(m: 'GET' | 'POST'): string {
  return m === 'GET'
    ? 'bg-blue-600/85 text-white'
    : 'bg-emerald-600/85 text-white'
}

function toggleSection(name: string): void {
  collapsed.value[name] = !collapsed.value[name]
}

function toggleParams(key: string): void {
  paramsOpen.value[key] = !paramsOpen.value[key]
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="group in groups"
      :key="group.name"
      class="rounded-xl border border-(--app-border) bg-(--app-card) overflow-hidden"
    >
      <!-- group header -->
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold app-text-secondary hover:bg-(--app-card-soft) transition"
        @click="toggleSection(group.name)"
      >
        <span class="text-[10px] transition" :class="collapsed[group.name] ? 'rotate-0' : 'rotate-90'">▶</span>
        {{ group.name }}
        <span class="ml-auto text-[10px] font-normal opacity-40">{{ group.apis.length }} APIs</span>
        <button
          type="button"
          class="ml-1 rounded border border-blue-500/30 px-1.5 py-0.5 text-[9px] text-blue-500 hover:bg-blue-500/10"
          @click.stop="batchExec(group.apis)"
        >
          全部
        </button>
      </button>

      <!-- api rows -->
      <div v-if="!collapsed[group.name]" class="border-t border-(--app-border)">
        <div
          v-for="api in group.apis"
          :key="api.path"
          class="border-b border-(--app-border)/60 last:border-b-0"
        >
          <div class="flex items-start gap-2 px-3 py-1.5">
            <span
              class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              :class="methodClass(api.method)"
            >{{ api.method }}</span>
            <!-- editable path -->
            <input
              :value="editedPaths[getKey(api)] ?? api.path"
              @input="(e: any) => editedPaths[getKey(api)] = e.target.value"
              class="text-[10px] font-mono app-text-primary bg-transparent border-b border-dashed border-(--app-border)/50 outline-none min-w-0 flex-1 px-0.5 py-0 focus:border-blue-500/60"
              :title="api.path"
            />
            <span class="text-[10px] app-text-muted shrink-0 hidden sm:inline">{{ api.label }}</span>
            <!-- param toggle -->
            <button
              v-if="hasParams(api)"
              type="button"
              class="shrink-0 rounded border border-(--app-border) px-1.5 py-0.5 text-[9px] transition"
              :class="paramsOpen[getKey(api)]
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600'
                : 'app-text-muted hover:border-(--app-border)'"
              @click="toggleParams(getKey(api))"
            >
              参数
            </button>
            <button
              type="button"
              class="shrink-0 rounded border border-(--app-border) px-2 py-0.5 text-[9px] font-medium transition hover:border-blue-500/50 hover:bg-blue-500/10 disabled:opacity-40"
              :disabled="loading[getKey(api)]"
              @click="execApi(getKey(api))"
            >
              {{ loading[getKey(api)] ? '...' : '执行' }}
            </button>
          </div>
          <!-- description -->
          <div v-if="api.desc" class="px-3 pb-0.5">
            <span class="text-[9px] text-amber-500">{{ api.desc }}</span>
          </div>
          <!-- parameter editor -->
          <div v-if="paramsOpen[getKey(api)]" class="mx-3 mb-1.5 space-y-1.5">
            <!-- POST body editor -->
            <div v-if="api.method === 'POST'">
              <p class="text-[9px] app-text-muted mb-0.5">Request Body (JSON)</p>
              <textarea
                :value="editedBodies[getKey(api)] ?? '{}'"
                @input="(e: any) => editedBodies[getKey(api)] = e.target.value"
                rows="8"
                class="w-full resize-y rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[10px] font-mono outline-none ring-amber-500/30 focus:border-amber-500/50 focus:ring-2 min-h-[120px]"
                spellcheck="false"
              />
            </div>
            <!-- GET query params editor -->
            <div v-if="api.method === 'GET' && api.queryParams !== undefined">
              <p class="text-[9px] app-text-muted mb-0.5">Query String</p>
              <input
                :value="editedQueries[getKey(api)] ?? ''"
                @input="(e: any) => editedQueries[getKey(api)] = e.target.value"
                class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[10px] font-mono outline-none ring-amber-500/30 focus:border-amber-500/50 focus:ring-2"
              />
            </div>
          </div>
          <!-- result -->
          <div
            v-if="results[getKey(api)]"
            class="mx-3 mb-1.5 rounded-md p-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto"
            :class="results[getKey(api)]?.ok
              ? 'bg-emerald-950/30 border border-emerald-500/20 text-emerald-300'
              : 'bg-red-950/30 border border-red-500/20 text-red-300'"
          >
            {{ results[getKey(api)]?.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
