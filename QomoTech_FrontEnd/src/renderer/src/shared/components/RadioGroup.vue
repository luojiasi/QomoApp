<script setup lang="ts">
defineProps<{
  /** v-model 绑定的选中值 */
  modelValue: string | number
  /** 选项列表 */
  options: { value: string | number; label: string }[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onSelect(value: string | number): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="flex cursor-pointer items-center gap-2 text-sm text-(--app-text-primary)"
      :class="{ 'cursor-not-allowed opacity-50': disabled }"
    >
      <!-- 自定义圆点 -->
      <span
        class="inline-flex h-4 w-4 items-center justify-center rounded-full border transition"
        :class="
          modelValue === opt.value
            ? 'border-sky-500 bg-sky-500'
            : 'border-(--app-border) bg-transparent'
        "
      >
        <span v-if="modelValue === opt.value" class="h-2 w-2 rounded-full bg-white" />
      </span>
      {{ opt.label }}
      <input
        type="radio"
        :value="opt.value"
        :checked="modelValue === opt.value"
        :disabled="disabled"
        class="sr-only"
        @change="onSelect(opt.value)"
      />
    </label>
  </div>
</template>
