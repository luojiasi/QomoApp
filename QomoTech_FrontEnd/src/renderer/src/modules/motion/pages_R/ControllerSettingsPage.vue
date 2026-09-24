<script setup lang="ts">
import ApiTestPanel from '@/modules/settings/ApiTestPanel.vue'
import ManualMotionPanel from '../panels/ManualMotionPanel.vue'
import { useControllerSettingsPageLogic } from './ControllerSettingsPage.logic.js'

const props = defineProps<{
  embedded?: boolean
}>()

const emit = defineEmits<{(e: 'back'): void}>()

const {
  controllerStore,
  axisCountValue,
  axisTabLabels,
  handleAxisCountChange,
  axisIndices,
  writeFields,
  fmtVal,
  axisSpeedUnit,
  speedInputValue,
  beginSpeedEdit,
  onSpeedDraftInput,
  commitSpeedEdit,
  normalizeAxisInput,
  isMergeParamField,
  mergeParamKey,
  userNumberKey,
  isBacklashEnableField,
  saving,
  handleSaveToFile,
  resetAllAxes,
  connecting,
  connected,
  handleConnect,
  stopping,
  handleEmergencyStop,
  ioOutputs,
  ioInputs,
  togglingIo,
  handleIoOutputToggle,
  axisNames,
  wsPosition,
  wsMposition,
  onlineCommandInput,
  onlineCommandResult,
  onlineCommandPending,
  commonOnlineCommands,
  selectedCommonOnlineCommand,
  applyCommonOnlineCommand,
  handleSendOnlineCommand,
  handleOpenOnlineCommandDoc
} = useControllerSettingsPageLogic()
</script>

<template>
  <div :class="props.embedded ? 'app-page min-h-0 px-4 py-4' : 'app-page min-h-screen px-6 py-10'">
    <!-- ================================================================
         非嵌入模式（独立页面）
         ================================================================ -->
    <div v-if="!props.embedded" class="mx-auto max-w-7xl space-y-5">

      <!-- 标题栏 -->
      <div class="app-card rounded-2xl p-6 shadow-lg">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold app-text-primary">控制器参数设置</h1>
            <p class="mt-1 text-sm app-text-muted">通讯、轴参数、I/O 与手动运动调试</p>
          </div>
          <div class="flex gap-2">
            <RouterLink
              to="/home"
              class="rounded-xl border border-(--app-border) px-4 py-2.5 text-sm font-medium app-text-primary transition hover:bg-(--app-card)"
            >
              返回首页
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- 通讯 + 控制栏 -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- 控制器信息 -->
        <div class="app-card rounded-2xl p-5 shadow-sm lg:col-span-2">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-xs app-text-muted">控制器型号</p>
              <p class="mt-1 text-xl font-semibold app-text-primary">
                {{ controllerStore.controllerSettings.communication.controller_model }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs app-text-muted">IP 地址</p>
              <input
                v-model="controllerStore.controllerSettings.communication.controller_ip"
                type="text"
                class="mt-1 w-44 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-1.5 text-sm text-center app-text-primary outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </div>
            <div class="text-right">
              <p class="text-xs app-text-muted">连接超时(秒)</p>
              <input
                v-model.number="controllerStore.controllerSettings.communication.connect_timeout_s"
                type="number"
                step="0.5"
                min="1"
                class="mt-1 w-20 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-1.5 text-sm text-center app-text-primary outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
              />
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-(--app-border) pt-4">
            <button
              type="button"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              :class="connected
                ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                : 'border-blue-500/50 bg-blue-600/90 text-white hover:bg-blue-600'"
              :disabled="connecting"
              @click="handleConnect"
            >
              {{ connecting ? '连接中...' : connected ? '已连接' : '连接控制器' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-900/50 disabled:opacity-50"
              :disabled="stopping"
              @click="handleEmergencyStop"
            >
              {{ stopping ? '急停中...' : '急停' }}
            </button>
            <span v-if="connected" class="ml-auto flex items-center gap-1.5 text-xs text-emerald-600">
              <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              已连接
            </span>
            <span v-else class="ml-auto flex items-center gap-1.5 text-xs app-text-muted">
              <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
              未连接
            </span>
          </div>
        </div>

        <!-- 轴数量切换 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <p class="text-xs app-text-muted">轴数量</p>
          <div class="mt-3 flex gap-2">
            <button
              v-for="n in ([3, 5] as const)"
              :key="n"
              type="button"
              class="flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors"
              :class="axisCountValue === n
                ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                : 'app-card-soft border-transparent hover:border-(--app-border)'"
              @click="handleAxisCountChange(n)"
            >
              {{ n === 3 ? '3 轴 (XYZ)' : '5 轴 (XYZUR)' }}
            </button>
          </div>
          <p class="mt-2 text-xs app-text-muted">
            当前: {{ axisTabLabels.join(' / ') }}
          </p>
        </div>
      </div>

      <!-- 轴实时位置（WS 推送） -->
      <div class="app-card rounded-2xl p-4 shadow-sm">
        <h3 class="text-sm font-semibold app-text-primary mb-2">
          轴位置
          <span class="ml-2 text-xs font-normal app-text-muted">
            指令(dpos) / 实际(mpos)
          </span>
        </h3>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="axisIdx in axisIndices"
            :key="`pos-${axisIdx}`"
            class="min-w-[120px] flex-1 rounded-lg border border-(--app-border) bg-(--app-card-soft) px-4 py-3 text-center"
          >
            <p class="text-xs font-semibold app-text-primary">
              轴{{ axisIdx }} <span class="font-normal opacity-50">{{ axisNames[axisIdx] }}</span>
            </p>
            <p class="mt-1 text-lg font-mono app-text-primary">
              {{ fmtVal(wsPosition[axisNames[axisIdx]]) }}
            </p>
            <p class="text-[11px] app-text-muted">
              mpos: {{ fmtVal(wsMposition[axisNames[axisIdx]]) }}
            </p>
          </div>
        </div>
      </div>

      <!-- IO 状态栏 -->
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- IO 输出 -->
        <div class="app-card rounded-2xl p-4 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold app-text-primary">
              I/O 数字量输出（可控制）
            </h3>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="(val, i) in ioOutputs"
              :key="`io-out-${i}`"
              type="button"
              class="min-w-[48px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
              :class="val
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-700'
                : 'border-(--app-border) bg-(--app-card-soft) app-text-muted hover:border-sky-400/50'"
              :disabled="Boolean(togglingIo[i])"
              @click="handleIoOutputToggle(i)"
            >
              {{ val ? 'ON' : 'OFF' }}<span class="ml-0.5 opacity-60">{{ i }}</span>
            </button>
          </div>
        </div>

        <!-- IO 输入 -->
        <div class="app-card rounded-2xl p-4 shadow-sm">
          <h3 class="text-sm font-semibold app-text-primary">I/O 数字量输入（只读）</h3>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="(val, i) in ioInputs"
              :key="`io-in-${i}`"
              class="min-w-[48px] rounded-lg border px-2.5 py-1.5 text-xs font-medium"
              :class="val
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-700'
                : 'border-(--app-border) bg-(--app-card-soft) app-text-muted'"
            >
              {{ val ? 'ON' : 'OFF' }}<span class="ml-0.5 opacity-60">{{ i }}</span>
            </span>
          </div>
        </div>
      </div>



      <!-- 轴参数 + 手动运动 -->
      <section class="space-y-5">
        <!-- 手动运动 -->
        <ManualMotionPanel :axis-count="axisCountValue" :axis-labels="axisTabLabels as string[]" />


        <!-- 轴参数卡片 -->
        <div class="app-card rounded-2xl p-6 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 border-b border-(--app-border) pb-3">
            <div class="ml-auto flex shrink-0 gap-2">
              <button
                type="button"
                class="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetAllAxes"
              >
                重置全部轴
              </button>
              <button
                type="button"
                class="rounded-lg border border-blue-500/50 bg-blue-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToFile"
              >
                {{ saving ? '保存中...' : '保存到文件' }}
              </button>
            </div>
          </div>

          <!-- 可配置（写入）表格 -->
          <div class="mt-4 overflow-x-auto">
            <table class="w-full border border-(--app-border) border-collapse text-xs">
              <thead>
                <tr class="bg-rose-950/10 border-b border-(--app-border)">
                  <th class="sticky left-0 z-10 bg-rose-950/10 px-3 py-2.5 text-left font-semibold app-text-secondary">
                    参数
                  </th>
                  <th
                    v-for="axisIdx in axisIndices"
                    :key="`write-h-${axisIdx}`"
                    class="px-3 py-2.5 text-center font-semibold app-text-secondary min-w-[80px]"
                  >
                    轴{{ axisIdx }}
                    <span class="block text-[10px] font-normal app-text-muted">{{ axisTabLabels[axisIdx] }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in writeFields"
                  :key="`write-${field.key}`"
                  class="border-b border-(--app-border) hover:bg-(--app-card-soft)/50"
                >
                  <td class="sticky left-0 z-5 bg-(--app-card) px-3 py-1.5 font-medium app-text-secondary">
                    {{ field.label }}
                  </td>
                  <td
                    v-for="axisIdx in axisIndices"
                    :key="`write-${field.key}-${axisIdx}`"
                    class="px-3 py-1"
                  >
                    <!-- 轴名称：文本 -->
                    <input
                      v-if="field.key === 'axis_name'"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].axis_name"
                      type="text"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    />
                    <!-- backlash_enable：下拉 -->
                    <select
                      v-else-if="isBacklashEnableField(field)"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].backlash_enable"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    >
                      <option :value="false">否</option>
                      <option :value="true">是</option>
                    </select>
                    <!-- merge_params 子字段 -->
                    <input
                      v-else-if="isMergeParamField(field)"
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx].merge_params[mergeParamKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                    <div
                      v-else-if="field.key === 'speed'"
                      class="flex flex-col items-center gap-0.5"
                    >
                      <input
                        :value="speedInputValue(axisIdx)"
                        type="number"
                        step="0.0001"
                        class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                        @focus="beginSpeedEdit(axisIdx)"
                        @input="onSpeedDraftInput(($event.target as HTMLInputElement).value)"
                        @blur="commitSpeedEdit(axisIdx)"
                      />
                      <span class="text-[10px] app-text-muted">{{ axisSpeedUnit(axisIdx) }}</span>
                    </div>
                    <!-- 通用数值 -->
                    <input
                      v-else
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-xs outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <!-- 在线命令卡片 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-semibold app-text-primary mb-3">在线命令</h3>
          <div class="grid gap-3 lg:grid-cols-[1fr_240px]">
            <div>
              <div class="flex gap-2">
                <input
                  v-model.trim="onlineCommandInput"
                  type="text"
                  class="flex-1 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs font-mono outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2"
                  placeholder="例如：?*set 或 VMOVE(1) AXIS(0)"
                  @keyup.enter="handleSendOnlineCommand"
                />
                <button
                  type="button"
                  class="rounded-lg border border-blue-500/40 bg-blue-600/85 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                  :disabled="onlineCommandPending"
                  @click="handleSendOnlineCommand"
                >
                  {{ onlineCommandPending ? '发送中...' : '发送' }}
                </button>
              </div>
              <textarea
                :value="onlineCommandResult"
                readonly
                rows="5"
                class="mt-2 w-full resize-none rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-xs font-mono opacity-90 outline-none app-text-primary"
                placeholder="命令返回信息将显示在这里..."
              />
              <p class="mt-1 text-[11px] app-text-muted leading-relaxed">
                {{ selectedCommonOnlineCommand ? `${selectedCommonOnlineCommand.description} — ${selectedCommonOnlineCommand.usage}` : '选择一个常用命令查看用法说明，或直接输入 ZMC 指令后按 Enter 发送。' }}
              </p>
            </div>

            <div class="rounded-lg border border-(--app-border) bg-(--app-card-soft) p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-xs font-medium app-text-muted">常用命令</span>
                <button
                  type="button"
                  class="rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-0.5 text-[10px] transition hover:border-blue-500/50 hover:bg-blue-500/10"
                  @click="handleOpenOnlineCommandDoc"
                >
                  文档
                </button>
              </div>
              <div class="space-y-1">
                <button
                  v-for="cmd in commonOnlineCommands"
                  :key="cmd.command"
                  type="button"
                  class="w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-tight transition"
                  :class="selectedCommonOnlineCommand?.command === cmd.command
                    ? 'border-blue-500/60 bg-blue-500/15 app-text-primary'
                    : 'border-transparent bg-(--app-input-bg) app-text-muted hover:border-blue-500/50 hover:bg-blue-500/10'"
                  @click="applyCommonOnlineCommand(cmd)"
                >
                  {{ cmd.description }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- API 测试面板 -->
      <ApiTestPanel />
    </div>

    <!-- ================================================================
         嵌入模式（Home 右侧面板）
         ================================================================ -->
    <div v-else class="mx-auto max-w-7xl space-y-4">
      <section class="space-y-4">
        <!-- 轴参数卡片 -->
        <div class="app-card rounded-2xl p-5 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 border-b border-(--app-border) pb-3 mb-3">
            <div class="ml-auto flex gap-1.5">
              <button
                type="button"
                class="rounded-md border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-medium text-rose-100 transition hover:bg-rose-900/50 disabled:opacity-50"
                :disabled="saving"
                @click="resetAllAxes"
              >
                重置全部轴
              </button>
              <button
                type="button"
                class="rounded-md border border-(--app-border) app-card-soft px-2.5 py-1 text-[11px] font-medium transition hover:bg-(--app-card)"
                @click="emit('back')"
              >
                关闭
              </button>
              <button
                type="button"
                class="rounded-md border border-blue-500/50 bg-blue-600/90 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                :disabled="saving"
                @click="handleSaveToFile"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>

          <!-- 可配置（写入）表格（嵌入模式也用可编辑 input） -->
          <div class="overflow-x-auto">
            <table class="w-full border border-(--app-border) border-collapse text-[11px]">
              <thead>
                <tr class="bg-rose-950/10 border-b border-(--app-border)">
                  <th class="sticky left-0 z-10 bg-rose-950/10 px-2 py-1.5 text-left font-semibold app-text-secondary">参数</th>
                  <th
                    v-for="axisIdx in axisIndices"
                    :key="`e-w-h-${axisIdx}`"
                    class="px-2 py-1.5 text-center font-semibold app-text-secondary"
                  >
                    轴{{ axisIdx }}
                    <span class="block text-[9px] font-normal app-text-muted">{{ axisTabLabels[axisIdx] }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in writeFields"
                  :key="`e-w-${field.key}`"
                  class="border-b border-(--app-border) hover:bg-(--app-card-soft)/50"
                >
                  <td class="sticky left-0 z-5 bg-(--app-card) px-2 py-1 font-medium app-text-secondary">{{ field.label }}</td>
                  <td
                    v-for="axisIdx in axisIndices"
                    :key="`e-w-${field.key}-${axisIdx}`"
                    class="px-2 py-1"
                  >
                    <!-- 轴名称：文本 -->
                    <input
                      v-if="field.key === 'axis_name'"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].axis_name"
                      type="text"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    />
                    <!-- backlash_enable：下拉 -->
                    <select
                      v-else-if="isBacklashEnableField(field)"
                      v-model="controllerStore.controllerSettings.axes[axisIdx].backlash_enable"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                    >
                      <option :value="false">否</option>
                      <option :value="true">是</option>
                    </select>
                    <!-- merge_params 子字段 -->
                    <input
                      v-else-if="isMergeParamField(field)"
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx].merge_params[mergeParamKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                    <div
                      v-else-if="field.key === 'speed'"
                      class="flex flex-col items-center gap-0.5"
                    >
                      <input
                        :value="speedInputValue(axisIdx)"
                        type="number"
                        step="0.0001"
                        class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                        @focus="beginSpeedEdit(axisIdx)"
                        @input="onSpeedDraftInput(($event.target as HTMLInputElement).value)"
                        @blur="commitSpeedEdit(axisIdx)"
                      />
                      <span class="text-[9px] app-text-muted">{{ axisSpeedUnit(axisIdx) }}</span>
                    </div>
                    <!-- 通用数值 -->
                    <input
                      v-else
                      v-model.number="controllerStore.controllerSettings.axes[axisIdx][userNumberKey(field)]"
                      type="number"
                      step="0.0001"
                      class="w-full rounded-md border border-(--app-border) bg-(--app-input-bg) px-2 py-1 text-[11px] outline-none ring-blue-500/30 focus:border-blue-500/50 focus:ring-2 text-center"
                      @blur="normalizeAxisInput(axisIdx, field.key)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
