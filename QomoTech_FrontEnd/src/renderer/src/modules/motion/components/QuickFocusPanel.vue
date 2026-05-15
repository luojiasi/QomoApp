<script setup lang="ts">
import { inject, reactive } from 'vue'
import FormField from '@/shared/components/FormField.vue'
import PrimaryButton from '@/shared/components/PrimaryButton.vue'

const state = reactive(inject<any>('quickFocus')!)
</script>

<template>
  <div class="mt-2 space-y-3">
    <PrimaryButton :disabled="state.isQuickFocusing" @click="state.handleQuickFocus">
      设定找焦点
    </PrimaryButton>
    <div
      class="grid gap-3 justify-items-center"
      :style="state.quickFocusDotGridStyle"
    >
      <span
        v-for="point in state.quickFocusPoints"
        :key="point.id"
        class="h-2.5 w-2.5 rounded-full ring-1"
        :class="state.getQuickFocusPointClass(point.state)"
      />
    </div>
    <div class="grid grid-cols-3 gap-2">
      <FormField v-model="state.quickFocusGridSize" label="X/Y 数量" :min="1" :step="1" :disabled="state.isQuickFocusing" />
      <FormField v-model="state.quickFocusStep" label="step" :min="0" :disabled="state.isQuickFocusing" />
      <FormField v-model="state.quickFocusZStep" label="Z_step" :min="0" :disabled="state.isQuickFocusing" />
    </div>
  </div>
</template>
