<script setup lang="ts">
import { inject, reactive } from 'vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'

const quickFocus = reactive(inject<any>('quickFocus')!)
const quickConcentric = reactive(inject<any>('quickConcentric')!)
</script>

<template>
  <div class="mt-2 space-y-3">
    <PrimaryButton :disabled="quickFocus.isQuickFocusing" @click="quickConcentric.handleQuickConcentric">
      快速找同心度
    </PrimaryButton>
  </div>
</template>
