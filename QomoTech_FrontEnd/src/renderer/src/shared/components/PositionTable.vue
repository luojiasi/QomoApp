<script setup lang="ts">
import type { PositionRow } from '@/shared/composables/usePositionTable'

defineProps<{
  rows: PositionRow[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: []
  record: [id: number]
  remove: [id: number]
  toggleEnabled: [id: number]
  updateStopPercent: [id: number, value: number]
}>()
</script>

<template>
  <div class="w-full overflow-x-auto text-xs">
    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b border-(--app-border) text-(--app-text-muted)">
          <th class="px-2 py-1.5 text-left font-normal">序号</th>
          <th class="px-2 py-1.5 text-left font-normal">点位</th>
          <th class="px-2 py-1.5 text-center font-normal">启用状态</th>
          <th class="px-2 py-1.5 text-center font-normal">停止百分比</th>
          <th class="px-2 py-1.5 text-center font-normal">
            <button
              type="button"
              class="rounded border border-sky-500/50 px-2 py-0.5 text-sky-400 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="disabled"
              @click="emit('add')"
            >
              添加
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="row.id"
          class="border-b border-(--app-border)/50 text-(--app-text-primary)"
        >
          <td class="px-2 py-1.5">{{ index + 1 }}</td>
          <td class="px-2 py-1.5 font-mono">
            ({{ row.x.toFixed(3) }}, {{ row.y.toFixed(3) }})
          </td>
          <td class="px-2 py-1.5 text-center">
            <button
              type="button"
              class="rounded px-2 py-0.5 text-xs transition"
              :class="
                row.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-slate-600/30 text-slate-500 hover:bg-slate-600/50'
              "
              :disabled="disabled"
              @click="emit('toggleEnabled', row.id)"
            >
              {{ row.enabled ? '启用' : '禁用' }}
            </button>
          </td>
          <td class="px-2 py-1.5 text-center">
            <input
              type="number"
              :value="row.stopPercent"
              min="0"
              max="100"
              class="w-14 rounded border border-(--app-border) bg-(--app-input-bg) px-1 py-0.5 text-center text-xs text-(--app-text-primary) outline-none"
              @input="
                (e) => {
                  const v = Number((e.target as HTMLInputElement).value)
                  if (Number.isFinite(v)) {
                    emit('updateStopPercent', row.id, v)
                  }
                }
              "
            />
          </td>
          <td class="flex items-center justify-center gap-1 px-2 py-1.5">
            <button
              type="button"
              class="rounded border border-sky-500/50 px-2 py-0.5 text-sky-400 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="disabled"
              @click="emit('record', row.id)"
            >
              记录
            </button>
            <button
              type="button"
              class="rounded border border-red-500/50 px-1.5 py-0.5 text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="disabled"
              @click="emit('remove', row.id)"
            >
              X
            </button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="5" class="px-2 py-4 text-center text-(--app-text-muted)">
            暂无点位，点击"添加"新增
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
