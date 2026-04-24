<template>
  <Teleport to="body">
    <div
      v-if="visible && diamondDetail"
      class="fixed inset-0 z-200 flex items-center justify-center bg-black/50"
    >
      <div
        class="w-[560px] max-w-[94vw] max-h-[85vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-lg shadow-black/40"
        @click.stop
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="text-2xl font-semibold text-slate-100">钻石参数详情</div>
          <div class="grid grid-cols-2 gap-2 text-2xl">
            <button
            type="button"
            class="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1 text-slate-200 hover:bg-slate-800"
            @click="emit('close')"
          >
            关闭
          </button>
          <button
            type="button"
            class="rounded-md border border-red-700 bg-red-800/40 px-2 py-1  text-slate-200 hover:bg-red-800"
            @click="emit('close')"
          >
            确定参数
          </button>
          </div>

        </div>

        <div class="grid grid-cols-3 gap-2 text-lg">
          <label class="flex flex-col gap-1 text-slate-300">
            ID
            <input
              :value="diamondDetail.id"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="text"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            名称
            <input
              :value="diamondDetail.name"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="text"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            R (半径)
            <input
              :value="diamondDetail.R"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            P
            <input
              :value="diamondDetail.P"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            L (长度)
            <input
              :value="diamondDetail.L"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            W (宽度)
            <input
              :value="diamondDetail.W"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            L/W (长宽比)
            <input
              :value="diamondDetail.LW"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            Tilt (倾斜)
            <input
              :value="diamondDetail.Tilt"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1 text-slate-300">
            SW
            <input
              :value="diamondDetail.SW"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              type="number"
              readonly
            />
          </label>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div
            v-for="group in ratioGroups"
            :key="group.key"
            class="rounded-md border border-slate-700 bg-slate-950/60 p-2"
          >
            <div class="mb-2 text-slate-100 text-2xl">{{ group.label }}</div>
            <div class="flex flex-col gap-2">
              <label class="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-slate-300 text-sm">
                <span class="whitespace-nowrap">实际比例：</span>
                <input
                  :value="group.value.Ratio"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  readonly
                />
              </label>
              <label class="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-slate-300 text-sm">
                <span class="whitespace-nowrap">实际尺寸：</span>
                <input
                  :value="group.value.Real"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  readonly
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiamondDetailParameters } from '@renderer/types/diamondTypes'

const props = defineProps<{
  visible: boolean
  diamondDetail: DiamondDetailParameters | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const ratioGroups = computed(() => {
  if (!props.diamondDetail) return []
  return [
    { key: 'Depth', label: 'Depth 全深', value: props.diamondDetail.Depth },
    { key: 'Yield', label: 'Yield', value: props.diamondDetail.Yield },
    { key: 'Pavilion', label: 'Pavilion 亭面', value: props.diamondDetail.Pavilion },
    { key: 'Crown', label: 'Crown 冠面', value: props.diamondDetail.Crown },
    { key: 'Girdle', label: 'Girdle 腰面', value: props.diamondDetail.Girdle },
    { key: 'Table', label: 'Table 台面', value: props.diamondDetail.Table }
  ]
})

</script>
