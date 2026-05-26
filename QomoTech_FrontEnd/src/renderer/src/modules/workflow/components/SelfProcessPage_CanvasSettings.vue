<script setup lang="ts">
// SelfProcessPage_CanvasSettings.vue — 右侧配置面板（画布设置 + 节点设置）
import { ref } from 'vue'
import { useCanvasSettings } from '../composables/useCanvasSettings'
import AppTabs from '../UI/AppTabs.vue'
import AppToggle from '../UI/AppToggle.vue'
import AppSelect from '../UI/AppSelect.vue'
import AppButton from '../UI/AppButton.vue'
import SelfProcessPage_NodeSettings from './SelfProcessPage_NodeSettings.vue'

const TABS: { key: string; label: string }[] = [
  { key: 'canvas', label: '画布设置' },
  { key: 'node',   label: '节点设置' }
]

const activeTab = ref<string>('canvas')

const {
  snapToGrid, snapGridSize,
  bgGap, bgSize, bgColor,
  showMiniMap, miniMapWidth, miniMapHeight, miniMapPosition,
  miniMapPositionOptions, edgeTypeOptions,
  minZoom, maxZoom, defaultViewportZoom,
  edgeColor, edgeStrokeWidth, edgeArrowStyle, edgeBorderRadius, edgeType,
  edgeArrowStyleOptions,
  ranges, resetToDefault
} = useCanvasSettings()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- Tab 切换栏 -->
    <AppTabs v-model="activeTab" :tabs="TABS" />

    <!-- ── Tab: 画布设置 ─────────────────────────────────────── -->
    <div v-show="activeTab === 'canvas'" class="flex flex-1 flex-col overflow-y-auto p-4 text-sm">

      <!-- 网格对齐 -->
      <section class="mb-5">
        <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">网格对齐</h4>
        <div class="space-y-3 rounded-lg border border-(--app-border) p-3">
          <AppToggle v-model="snapToGrid" label="吸附到网格" />
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">网格大小</span>
            <input
              type="range"
              v-model.number="snapGridSize"
              :min="ranges.snapGridSize.min"
              :max="ranges.snapGridSize.max"
              :step="ranges.snapGridSize.step"
              class="h-1 flex-1 cursor-pointer"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ snapGridSize }}px</span>
          </div>
        </div>
      </section>

      <!-- 背景网格 -->
      <section class="mb-5">
        <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">背景网格</h4>
        <div class="space-y-3 rounded-lg border border-(--app-border) p-3">
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">间隔</span>
            <input type="range" v-model.number="bgGap" :min="ranges.bgGap.min" :max="ranges.bgGap.max" :step="ranges.bgGap.step" class="h-1 flex-1 cursor-pointer" />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ bgGap }}px</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">点大小</span>
            <input type="range" v-model.number="bgSize" :min="ranges.bgSize.min" :max="ranges.bgSize.max" :step="ranges.bgSize.step" class="h-1 flex-1 cursor-pointer" />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ bgSize }}px</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">颜色</span>
            <input type="color" v-model="bgColor" class="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
            <span class="text-[11px] text-(--app-text-muted)">{{ bgColor }}</span>
          </div>
        </div>
      </section>

      <!-- 连线 -->
      <section class="mb-5">
        <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">连线</h4>
        <div class="space-y-3 rounded-lg border border-(--app-border) p-3">
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">线条颜色</span>
            <input type="color" v-model="edgeColor" class="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
            <span class="text-[11px] text-(--app-text-muted)">{{ edgeColor }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">线条粗细</span>
            <input
              type="range"
              v-model.number="edgeStrokeWidth"
              :min="ranges.edgeStrokeWidth.min"
              :max="ranges.edgeStrokeWidth.max"
              :step="ranges.edgeStrokeWidth.step"
              class="h-1 flex-1 cursor-pointer"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ edgeStrokeWidth }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">箭头样式</span>
            <AppSelect v-model="edgeArrowStyle" :options="edgeArrowStyleOptions" :required="true" class="flex-1" />
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">连接类型</span>
            <AppSelect v-model="edgeType" :options="edgeTypeOptions" :required="true" class="flex-1" />
          </div>
          <div v-if="edgeType === 'smoothstep' || edgeType === 'step'" class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">圆角弧度</span>
            <input
              type="range"
              v-model.number="edgeBorderRadius"
              :min="ranges.edgeBorderRadius.min"
              :max="ranges.edgeBorderRadius.max"
              :step="ranges.edgeBorderRadius.step"
              class="h-1 flex-1 cursor-pointer"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ edgeBorderRadius }}px</span>
          </div>
        </div>
      </section>

      <!-- 视口缩放 -->
      <section class="mb-5">
        <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">视口缩放</h4>
        <div class="space-y-3 rounded-lg border border-(--app-border) p-3">
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">默认缩放</span>
            <input type="range" v-model.number="defaultViewportZoom" :min="ranges.defaultViewportZoom.min" :max="ranges.defaultViewportZoom.max" :step="ranges.defaultViewportZoom.step" class="h-1 flex-1 cursor-pointer" />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ defaultViewportZoom }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">最小缩放</span>
            <input type="range" v-model.number="minZoom" :min="ranges.minZoom.min" :max="ranges.minZoom.max" :step="ranges.minZoom.step" class="h-1 flex-1 cursor-pointer" />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ minZoom }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">最大缩放</span>
            <input type="range" v-model.number="maxZoom" :min="ranges.maxZoom.min" :max="ranges.maxZoom.max" :step="ranges.maxZoom.step" class="h-1 flex-1 cursor-pointer" />
            <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ maxZoom }}</span>
          </div>
        </div>
      </section>

      <!-- 小地图 -->
      <section class="mb-5">
        <h4 class="mb-3 text-[13px] font-bold text-(--app-text-primary)">小地图</h4>
        <div class="space-y-3 rounded-lg border border-(--app-border) p-3">
          <AppToggle v-model="showMiniMap" label="显示小地图" />
          <template v-if="showMiniMap">
            <div class="flex items-center gap-2">
              <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">宽度</span>
              <input type="range" v-model.number="miniMapWidth" :min="ranges.miniMapWidth.min" :max="ranges.miniMapWidth.max" :step="ranges.miniMapWidth.step" class="h-1 flex-1 cursor-pointer" />
              <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ miniMapWidth }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">高度</span>
              <input type="range" v-model.number="miniMapHeight" :min="ranges.miniMapHeight.min" :max="ranges.miniMapHeight.max" :step="ranges.miniMapHeight.step" class="h-1 flex-1 cursor-pointer" />
              <span class="w-8 text-right text-[11px] tabular-nums text-(--app-text-primary)">{{ miniMapHeight }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="min-w-[70px] text-[11px] text-(--app-text-muted)">位置</span>
              <AppSelect v-model="miniMapPosition" :options="miniMapPositionOptions" :required="true" class="flex-1" />
            </div>
          </template>
        </div>
      </section>

      <div class="mt-auto pt-2">
        <AppButton variant="ghost" class="w-full" @click="resetToDefault">恢复默认</AppButton>
      </div>

    </div>

    <!-- ── Tab: 节点设置 ─────────────────────────────────────── -->
    <div v-show="activeTab === 'node'" class="flex-1 overflow-hidden">
      <SelfProcessPage_NodeSettings />
    </div>

  </div>
</template>
