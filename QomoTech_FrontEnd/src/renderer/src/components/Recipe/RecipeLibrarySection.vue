<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
  addButtonText: string
}>()

const emit = defineEmits<{
  (event: 'add'): void
}>()
</script>

<template>
  <section class="app-card rounded-2xl p-6 shadow-sm">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 class="app-text-primary text-xl font-semibold">{{ props.title }}</h2>
        <p class="app-text-secondary mt-2 text-sm">
          {{ props.description }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        @click="emit('add')"
      >
        {{ props.addButtonText }}
      </button>
    </div>

    <slot />
  </section>
</template>
