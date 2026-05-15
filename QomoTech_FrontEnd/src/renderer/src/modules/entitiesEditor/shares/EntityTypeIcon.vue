<script setup lang="ts">
import type { EntityKind } from "@/modules/entitiesEditor/commons/types"

defineProps<{ kind: EntityKind }>()
</script>

<template>
  <span class="entity-icon" :class="`icon-${kind.toLowerCase()}`">
    <span v-if="kind === 'LINE'" class="i-line">━</span>
    <span v-else-if="kind === 'ARC'" class="i-arc">⌒</span>
    <span v-else-if="kind === 'BEZIER'" class="i-bezier">∿</span>
  </span>
</template>

<style scoped>
.entity-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 14px;
  color: #a1a1aa;
}
</style>
