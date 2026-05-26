<script setup lang="ts">
// WorkflowCanvas_Edge.vue — 自定义连线路径（修正底部端口水平连线时箭头朝向）
import { computed } from 'vue'
import {
  BaseEdge,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps
} from '@vue-flow/core'
import { resolveEdgeHandlePositions } from '../utils/edgePathUtils'

const props = defineProps<
  EdgeProps & {
    borderRadius?: number
    offset?: number
  }
>()

const pathParams = computed(() => {
  const { sourcePosition, targetPosition } = resolveEdgeHandlePositions(
    props.sourceX,
    props.sourceY,
    props.targetX,
    props.targetY
  )

  const common = {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition
  }

  if (props.type === 'straight') {
    return getStraightPath(common)
  }

  return getSmoothStepPath({
    ...common,
    borderRadius: props.borderRadius ?? 0,
    offset: props.offset ?? 20
  })
})
</script>

<template>
  <BaseEdge
    :id="id"
    :path="pathParams[0]"
    :label-x="pathParams[1]"
    :label-y="pathParams[2]"
    :marker-end="markerEnd"
    :marker-start="markerStart"
    :style="style"
    :interaction-width="interactionWidth"
  />
</template>
