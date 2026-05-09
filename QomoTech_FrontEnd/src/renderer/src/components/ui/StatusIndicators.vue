<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useBackendStatus } from '../../composables/useBackendStatus'
import { useHardwareState } from '../../api/hardware'

const props = withDefaults(defineProps<{ showMessage?: boolean }>(), { showMessage: false })

const { backendStatus, backendDotClass, startPolling } = useBackendStatus()
const { controllerConnected, cameraConnected } = useHardwareState()

onMounted(() => {
  startPolling()
})

const controllerDotClass = computed(() =>
  controllerConnected.value ? 'bg-green-500' : 'bg-red-500'
)

const cameraDotClass = computed(() =>
  cameraConnected.value ? 'bg-green-500' : 'bg-red-500'
)

const backendReady = computed(() => backendStatus.value.state === 'running')

defineExpose({
  backendReady,
  backendMessage: computed(() => backendStatus.value.message)
})
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-1" title="后端服务状态">
      <span class="h-2 w-2 rounded-full" :class="backendDotClass" />
      <span class="text-xs text-(--app-text-secondary)">后台</span>
      <span v-if="showMessage" class="text-xs text-(--app-text-secondary)">{{ backendStatus.message }}</span>
    </div>
    <div class="flex items-center gap-1" title="控制器连接状态">
      <span class="h-2 w-2 rounded-full" :class="controllerDotClass" />
      <span class="text-xs text-(--app-text-secondary)">控制器</span>
    </div>
    <div class="flex items-center gap-1" title="相机连接状态">
      <span class="h-2 w-2 rounded-full" :class="cameraDotClass" />
      <span class="text-xs text-(--app-text-secondary)">相机</span>
    </div>
  </div>
</template>
