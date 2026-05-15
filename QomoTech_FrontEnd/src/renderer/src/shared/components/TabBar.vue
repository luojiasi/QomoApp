<script setup lang="ts">
defineProps<{
  tabs: { id: string; label: string; disabled?: boolean }[]
  modelValue: string
  /** 为 true 时禁用全部标签（与各 tab 的 disabled 取或） */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="flex flex-col-5 gap-2">
    <button
      v-for="item in tabs"
      :key="item.id"
      type="button"
      :disabled="Boolean(disabled) || Boolean(item.disabled)"
      class="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
      :class="
        modelValue === item.id
          ? 'border-sky-500/70 bg-sky-500/10 text-(--app-text-primary)'
          : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-primary) hover:border-sky-500/35 hover:bg-(--app-card)'
      "
      @click="emit('update:modelValue', item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
