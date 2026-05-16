<script setup lang="ts">

</script>

<template>
  <div class="canvas-2d">
    <div class="canvas-surface">
      <div class="placeholder">
        <span class="placeholder-icon">▦</span>
        <span class="placeholder-text">2D Canvas</span>
        <span class="placeholder-hint">绘制区域</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-2d {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.canvas-surface {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(90deg, #1a1a20 1px, transparent 1px),
    linear-gradient(0deg, #1a1a20 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: center center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0.3;
}
.placeholder-icon { font-size: 36px; color: #52525b; }
.placeholder-text { font-size: 14px; color: #71717a; letter-spacing: 1px; text-transform: uppercase; }
.placeholder-hint { font-size: 11px; color: #52525b; }
</style>
