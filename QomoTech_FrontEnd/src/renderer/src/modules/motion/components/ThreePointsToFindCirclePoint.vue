<script setup lang="ts">
import { inject, reactive } from 'vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'
import StatusCard from '@/shared/components/StatusCard.vue'

const threePoints = reactive(inject<any>('threePointsToFindCirclePoint')!)
</script>

<template>
  <div class="mt-2 space-y-3">
    <!-- 三个采样点记录按钮 -->
    <div class="grid grid-cols-3 gap-2">
      <PrimaryButton
        v-for="point in threePoints.points"
        :key="point.id"
        :disabled="point.state === 'done'"
        @click="threePoints.recordPoint(point.id)"
      >
        {{ point.state === 'done' ? `点${point.id + 1} ✓` : `记录点${point.id + 1}` }}
      </PrimaryButton>
    </div>

    <!-- 已记录坐标展示 -->
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="point in threePoints.points"
        :key="'card-' + point.id"
        class="rounded-lg border p-2 text-xs"
        :class="point.state === 'done'
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-(--app-border) bg-(--app-input-bg)'"
      >
        <div class="mb-1 font-medium">点{{ point.id + 1 }}</div>
        <div>X: {{ threePoints.formatCoord(point.X) }}</div>
        <div>Y: {{ threePoints.formatCoord(point.Y) }}</div>
        <div>Z: {{ threePoints.formatCoord(point.Z) }}</div>
      </div>
    </div>

    <!-- 圆心计算结果 -->
    <div v-if="threePoints.allPointsDone && threePoints.circleCenter" class="rounded-lg border border-(--app-border) bg-(--app-card-soft) p-3">
      <p class="mb-2 text-xs font-medium text-(--app-text-muted)">圆心结果</p>
      <div class="grid grid-cols-3 gap-2">
        <StatusCard label="圆心 X" :value="threePoints.formatCoord(threePoints.circleCenter.X)" />
        <StatusCard label="圆心 Y" :value="threePoints.formatCoord(threePoints.circleCenter.Y)" />
        <StatusCard label="半径 R" :value="threePoints.formatCoord(threePoints.circleCenter.radius)" />
      </div>
    </div>

    <p v-else-if="threePoints.allPointsDone && !threePoints.circleCenter" class="text-xs text-red-500">
      三点共线，无法确定圆心
    </p>

    <!-- 清除单个点 -->
    <div class="grid grid-cols-3 gap-2">
      <PrimaryButton
        v-for="point in threePoints.points"
        :key="'clear-' + point.id"
        :disabled="point.state !== 'done'"
        @click="threePoints.clearPoint(point.id)"
      >
        清除找到的点{{ point.id + 1 }}坐标
      </PrimaryButton>
    </div>

    <!-- 清除全部 -->
    <PrimaryButton @click="threePoints.clearPoints">
      清除全部找到的点坐标
    </PrimaryButton>

    <!-- 移动到圆心 -->
    <PrimaryButton
      :disabled="!threePoints.circleCenter || threePoints.isMovingToCenter"
      @click="threePoints.moveToCenter"
    >
      {{ threePoints.isMovingToCenter ? '移动中...' : '移动到圆心位置' }}
    </PrimaryButton>

    <p class="text-xs text-(--app-text-muted)">
      将轴依次移动至圆周上任意三个位置，分别记录坐标后自动计算圆心与半径
    </p>
  </div>
</template>
