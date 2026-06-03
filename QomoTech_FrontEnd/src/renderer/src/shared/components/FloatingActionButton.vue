<template>
  <button
    class="fab-button group"
    type="button"
    :aria-label="label"
    @click="$emit('click')"
  >
    <SvgIcon :icon-name="icon" class-name="fab-icon" />
    <span class="fab-tooltip" role="tooltip">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import SvgIcon from '@/shared/components/SvgIcon.vue'

defineProps<{
  icon: string
  label: string
}>()

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.fab-button {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 0.5px solid rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  color: var(--app-text-primary);
  box-shadow:
    0 0.5px 0 rgba(255, 255, 255, 0.9) inset,
    0 1px 1px rgba(0, 0, 0, 0.04),
    0 6px 20px rgba(0, 0, 0, 0.08),
    0 12px 32px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1),
    box-shadow 0.22s cubic-bezier(0.25, 0.1, 0.25, 1),
    background 0.22s ease,
    border-color 0.22s ease;
}

.fab-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.08) 48%,
    rgba(255, 255, 255, 0.2) 100%
  );
  pointer-events: none;
}

.fab-button:hover {
  background: rgba(255, 255, 255, 0.68);
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow:
    0 0.5px 0 rgba(255, 255, 255, 0.95) inset,
    0 2px 6px rgba(0, 0, 0, 0.06),
    0 10px 28px rgba(0, 0, 0, 0.1),
    0 18px 40px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.fab-button:active {
  transform: scale(0.96);
  transition-duration: 0.1s;
}

.fab-icon {
  position: relative;
  z-index: 1;
  width: 1.375rem;
  height: 1.375rem;
}

/* 悬浮磨砂标签 */
.fab-tooltip {
  position: absolute;
  right: calc(100% + 12px);
  top: 50%;
  z-index: 51;
  transform: translate(6px, -50%);
  padding: 0.5rem 0.875rem;
  border: 0.5px solid rgba(255, 255, 255, 0.42);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(24px) saturate(190%);
  -webkit-backdrop-filter: blur(24px) saturate(190%);
  color: var(--app-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.2;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  box-shadow:
    0 0.5px 0 rgba(255, 255, 255, 0.85) inset,
    0 4px 16px rgba(0, 0, 0, 0.1);
  transition:
    opacity 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.fab-button:hover .fab-tooltip,
.fab-button:focus-visible .fab-tooltip {
  opacity: 1;
  transform: translate(0, -50%);
}

:root[data-theme='dark'] .fab-button {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(50, 50, 52, 0.62);
  color: var(--app-text-primary);
  box-shadow:
    0 0.5px 0 rgba(255, 255, 255, 0.1) inset,
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.4);
}

:root[data-theme='dark'] .fab-button::before {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0.02) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
}

:root[data-theme='dark'] .fab-button:hover {
  background: rgba(62, 62, 66, 0.72);
}

:root[data-theme='dark'] .fab-tooltip {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(44, 44, 46, 0.72);
  color: var(--app-text-primary);
  box-shadow:
    0 0.5px 0 rgba(255, 255, 255, 0.08) inset,
    0 4px 20px rgba(0, 0, 0, 0.35);
}
</style>
