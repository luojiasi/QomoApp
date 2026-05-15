<script setup lang="ts">
import { inject, reactive } from 'vue'
import StatusCard from '@/shared/components/StatusCard.vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'

const quickFocus = reactive(inject<any>('quickFocus')!)
const quickMove = reactive(inject<any>('quickMove')!)
</script>

<template>
  <div class="mt-2 space-y-3">
    <PrimaryButton :disabled="quickFocus.isQuickFocusing" @click="quickMove.handleSaveQuickMoveToPosition">
      获取并保存当前位置 XYZ
    </PrimaryButton>
    <div class="grid grid-cols-3 gap-2">
      <StatusCard label="X" :value="quickMove.displayQuickMoveAxis('X')" />
      <StatusCard label="Y" :value="quickMove.displayQuickMoveAxis('Y')" />
      <StatusCard label="Z" :value="quickMove.displayQuickMoveAxis('Z')" />
    </div>
    <p class="text-sm text-gray-500">
      注意:1.回零会根据此位置快速到达 ；2.H快捷键会根据此位置快速到达
    </p>
  </div>
</template>
