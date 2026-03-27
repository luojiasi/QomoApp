<script setup lang="ts">
import type { ParameterField, ParameterFieldGroup } from '../types/settings'
import { formatSettingValue } from '../utils/settings'

const props = defineProps<{
  title: string
  description: string
  fields: ParameterField[]
  fieldGroups?: ParameterFieldGroup[]
}>()
</script>

<template>
  <section class="rounded-2xl bg-(--app-card-soft) p-4 pr-14 pt-10">
    <h3 class="text-base font-semibold leading-snug text-(--app-text-primary)">
      {{ props.title }}
    </h3>
    <p class="mt-1.5 text-xs leading-snug text-(--app-text-muted)">
      {{ props.description }}
    </p>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <template v-if="props.fieldGroups?.length">
        <div
          v-for="field in props.fields"
          :key="field.key"
          class="rounded-2xl border border-(--app-border) bg-(--app-input-bg) px-3 py-2.5"
        >
          <p class="text-xs leading-tight text-(--app-text-muted)">{{ field.label }}</p>
          <p class="mt-1 break-all text-sm font-medium text-(--app-text-primary)">
            {{ formatSettingValue(field.value, field.unit) }}
          </p>
        </div>
        <div
          v-for="group in props.fieldGroups"
          :key="group.id"
          class="col-span-full w-full min-w-0"
        >
          <h4 class="mb-2 text-sm font-semibold text-(--app-text-primary)">
            {{ group.title }}
          </h4>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              v-for="field in group.fields"
              :key="field.key"
              class="rounded-2xl border border-(--app-border) bg-(--app-input-bg) px-3 py-2.5"
            >
              <p class="text-xs leading-tight text-(--app-text-muted)">
                {{ field.label }}
              </p>
              <p class="mt-1 break-all text-sm font-medium text-(--app-text-primary)">
                {{ formatSettingValue(field.value, field.unit) }}
              </p>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="field in props.fields"
          :key="field.key"
          class="rounded-2xl border border-(--app-border) bg-(--app-input-bg) px-3 py-2.5"
        >
          <p class="text-xs leading-tight text-(--app-text-muted)">{{ field.label }}</p>
          <p class="mt-1 break-all text-sm font-medium text-(--app-text-primary)">
            {{ formatSettingValue(field.value, field.unit) }}
          </p>
        </div>
      </template>
    </div>
  </section>
</template>
