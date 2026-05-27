// ─────────────────────────────────────────────────────────────
// composables/useCanvasSettings.ts — 画布配置状态（单例）
//
// defaults（constants） + override（持久化） → effective（生效值）
// ─────────────────────────────────────────────────────────────

import { computed, ref, watch } from 'vue'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { Workflow } from '../types/workflow'
import type { CanvasSettings, CanvasSettingsOverride } from '../types/canvasSettings'
import { CANVAS_SETTINGS_DEFAULTS } from '../constants/canvasSettingsDefaults'
import {
  EDGE_ARROW_STYLE_OPTIONS,
  EDGE_TYPE_OPTIONS,
  MINI_MAP_POSITION_OPTIONS
} from '../constants/canvasSettingsOptions'
import { CANVAS_SETTINGS_RANGES } from '../constants/canvasSettingsConstraints'
import {
  mergeCanvasSettings,
  pruneCanvasSettingsOverride,
  readCanvasSettingsOverride
} from '../utils/canvasSettingsUtils'

const override = ref<CanvasSettingsOverride>({})

const effective = computed<CanvasSettings>(() => mergeCanvasSettings(override.value))

function setField<K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]): void {
  override.value = pruneCanvasSettingsOverride(override.value, key, value)
}

function loadFromWorkflow(wf: Workflow | null): void {
  override.value = readCanvasSettingsOverride(wf?.canvasSettings)
}

function applyToWorkflow(wf: Workflow | null): void {
  if (!wf) return
  wf.canvasSettings = { ...override.value }
}

function resetToDefault(): void {
  override.value = {}
}

function createFieldComputed<K extends keyof CanvasSettings>(key: K) {
  return computed({
    get: () => effective.value[key],
    set: (v: CanvasSettings[K]) => setField(key, v)
  })
}

export function useCanvasSettings() {
  const store = useWorkflowStore()

  watch(
    () => store.currentWorkflow?.id,
    () => loadFromWorkflow(store.currentWorkflow),
    { immediate: true }
  )

  watch(
    override,
    () => applyToWorkflow(store.currentWorkflow),
    { deep: true }
  )

  return {
    override,
    effective,
    defaults: CANVAS_SETTINGS_DEFAULTS,
    ranges: CANVAS_SETTINGS_RANGES,
    miniMapPositionOptions: MINI_MAP_POSITION_OPTIONS,
    edgeTypeOptions: EDGE_TYPE_OPTIONS,
    edgeArrowStyleOptions: EDGE_ARROW_STYLE_OPTIONS,
    resetToDefault,
    loadFromWorkflow,
    applyToWorkflow,
    snapToGrid: createFieldComputed('snapToGrid'),
    snapGridSize: createFieldComputed('snapGridSize'),
    bgGap: createFieldComputed('bgGap'),
    bgSize: createFieldComputed('bgSize'),
    bgColor: createFieldComputed('bgColor'),
    showMiniMap: createFieldComputed('showMiniMap'),
    miniMapWidth: createFieldComputed('miniMapWidth'),
    miniMapHeight: createFieldComputed('miniMapHeight'),
    miniMapPosition: createFieldComputed('miniMapPosition'),
    defaultViewportX: createFieldComputed('defaultViewportX'),
    defaultViewportY: createFieldComputed('defaultViewportY'),
    defaultViewportZoom: createFieldComputed('defaultViewportZoom'),
    minZoom: createFieldComputed('minZoom'),
    maxZoom: createFieldComputed('maxZoom'),
    edgeColor: createFieldComputed('edgeColor'),
    edgeStrokeWidth: createFieldComputed('edgeStrokeWidth'),
    edgeArrowStyle: createFieldComputed('edgeArrowStyle'),
    edgeBorderRadius: createFieldComputed('edgeBorderRadius'),
    edgeType: createFieldComputed('edgeType'),
    nodeBorderWidth: createFieldComputed('nodeBorderWidth')
  }
}
