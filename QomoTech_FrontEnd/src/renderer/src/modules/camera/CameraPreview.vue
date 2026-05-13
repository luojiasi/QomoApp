<script setup lang="ts">
import { computed } from 'vue'
import { refreshGlobalCameraStream, useGlobalCameraReceiverState } from './useCameraReceiver'

const props = withDefaults(
  defineProps<{
    alt?: string
    objectFit?: 'contain' | 'cover' | 'fill'
    showHint?: boolean
    hiddenKeepAlive?: boolean
  }>(),
  {
    alt: 'camera-image',
    objectFit: 'contain',
    showHint: true,
    hiddenKeepAlive: false
  }
)

const { frameUrl, lastError } = useGlobalCameraReceiverState()

const fitClass = computed(() => {
  if (props.objectFit === 'cover') return 'object-cover'
  if (props.objectFit === 'fill') return 'object-fill'
  return 'object-contain'
})

function handleImgError(): void {
  refreshGlobalCameraStream()
}
</script>

<template>
  <div
    class="relative h-full w-full overflow-hidden"
    :class="hiddenKeepAlive ? 'pointer-events-none fixed left-0 top-0 h-px w-px opacity-0' : ''"
    :aria-hidden="hiddenKeepAlive ? 'true' : 'false'"
  >
    <img
      v-if="frameUrl"
      :src="frameUrl"
      :alt="alt"
      class="h-full w-full"
      :class="fitClass"
      draggable="false"
      @error="handleImgError"
    />
    <div v-else class="flex h-full w-full items-center justify-center">
      <p class="app-text-muted text-sm">
        {{ showHint ? '正在接收相机图像…' : '' }}
      </p>
    </div>
    <p v-if="lastError && showHint" class="absolute bottom-2 left-2 rounded bg-black/45 px-2 py-1 text-xs text-white">
      {{ lastError }}
    </p>
  </div>
</template>
