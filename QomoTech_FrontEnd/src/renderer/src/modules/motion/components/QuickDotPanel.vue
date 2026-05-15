<script setup lang="ts">
import { inject, reactive } from 'vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'

const quickFocus = reactive(inject<any>('quickFocus')!)
</script>

<template>
  <div class="mt-2 space-y-3">
    <PrimaryButton :disabled="quickFocus.isQuickFocusing">
      快速打点
    </PrimaryButton>
  </div>
</template>
