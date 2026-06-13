<script setup lang="ts">
import { ref } from 'vue'

const exposure = ref(25)
const gain = ref(12)
const focusDepth = ref(152.4)
const zoomLevel = ref(2.5)
</script>

<template>
  <div class="monitor-page">
    <div class="video-feed">
      <div class="video-placeholder">
        <span class="video-text">VIDEO FEED — NO SIGNAL</span>
      </div>

      <!-- Crosshair overlay -->
      <div class="crosshair-overlay">
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
        <div class="crosshair-ring ring-1"></div>
        <div class="crosshair-ring ring-2"></div>
        <div class="crosshair-center"></div>
      </div>

      <!-- Top-left HUD -->
      <div class="hud-top-left">
        <div class="hud-card">
          <div class="hud-label">Camera Feed 01</div>
          <div class="hud-value">60.00 FPS</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">Resolution</div>
          <div class="hud-value">3840 x 2160</div>
        </div>
      </div>

      <!-- Bottom-left coordinates -->
      <div class="hud-bottom-left">
        <div class="coords-header">
          <span class="material-symbols-outlined coords-icon">location_searching</span>
          <span class="coords-title">Coordinates</span>
        </div>
        <div class="coords-grid">
          <div class="coord">
            <div class="coord-label">X</div>
            <div class="coord-value">142.04</div>
          </div>
          <div class="coord">
            <div class="coord-label">Y</div>
            <div class="coord-value">-32.11</div>
          </div>
          <div class="coord">
            <div class="coord-label">Z</div>
            <div class="coord-value">10.00</div>
          </div>
        </div>
      </div>

      <!-- Bottom-right status -->
      <div class="hud-bottom-right">
        <div class="status-group">
          <div class="status-label">Laser Status</div>
          <div class="status-row">
            <span class="armed-dot"></span>
            <span class="armed-text">ARMED</span>
          </div>
        </div>
        <div class="status-divider"></div>
        <div class="status-group">
          <div class="status-label">Gas Pressure</div>
          <div class="status-value">8.4 BAR</div>
        </div>
      </div>
    </div>

    <!-- Camera sidebar -->
    <aside class="camera-sidebar">
      <h3 class="sidebar-title">
        <span class="material-symbols-outlined">tune</span>
        Camera Parameters
      </h3>

      <!-- Exposure -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">Exposure (ms)</label>
          <span class="param-value">{{ exposure }}.0</span>
        </div>
        <input v-model.number="exposure" type="range" min="0" max="100" class="param-slider" />
        <div class="param-range-labels">
          <span>0.1</span>
          <span>100.0</span>
        </div>
      </div>

      <!-- Gain -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">Gain (dB)</label>
          <span class="param-value">{{ gain }}.0</span>
        </div>
        <input v-model.number="gain" type="range" min="0" max="48" class="param-slider" />
        <div class="param-range-labels">
          <span>0.0</span>
          <span>48.0</span>
        </div>
      </div>

      <!-- Focus -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">Focus Depth (mm)</label>
          <span class="param-value">{{ focusDepth }}</span>
        </div>
        <div class="focus-controls">
          <button class="focus-btn"><span class="material-symbols-outlined">remove</span></button>
          <input v-model.number="focusDepth" type="range" min="100" max="200" class="param-slider flex-1" />
          <button class="focus-btn"><span class="material-symbols-outlined">add</span></button>
        </div>
      </div>

      <!-- Digital Zoom -->
      <div class="param-group">
        <div class="param-header">
          <label class="param-label">Digital Zoom</label>
          <span class="param-value">{{ zoomLevel }}x</span>
        </div>
        <div class="zoom-buttons">
          <button
            v-for="z in [1, 2.5, 5, 10]"
            :key="z"
            class="zoom-btn"
            :class="{ active: zoomLevel === z }"
            @click="zoomLevel = z"
          >{{ z }}x</button>
        </div>
      </div>

      <div class="sidebar-actions">
        <button class="action-btn primary">
          <span class="material-symbols-outlined">screenshot_region</span>
          Capture Frame
        </button>
        <button class="action-btn secondary">
          <span class="material-symbols-outlined">videocam_off</span>
          Disable Preview
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.video-feed {
  flex: 1;
  position: relative;
  background: var(--color-surface-container-lowest);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--color-outline-variant);
  letter-spacing: 0.2em;
}

/* Crosshair */
.crosshair-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.crosshair-h, .crosshair-v {
  position: absolute;
  background: rgba(173, 199, 255, 0.4);
}

.crosshair-h { width: 100%; height: 1px; }
.crosshair-v { width: 1px; height: 100%; }

.crosshair-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
}

.ring-1 {
  width: 64px;
  height: 64px;
  border-color: rgba(173, 199, 255, 0.3);
}

.ring-2 {
  width: 192px;
  height: 192px;
  border-color: rgba(173, 199, 255, 0.1);
}

.crosshair-center {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(173, 199, 255, 0.8);
}

/* HUD elements */
.hud-top-left {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hud-card, .hud-bottom-left, .hud-bottom-right {
  background: rgba(28, 32, 39, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 4px;
}

.hud-label {
  font-size: 10px;
  color: rgba(173, 199, 255, 0.7);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.hud-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.hud-bottom-left {
  position: absolute;
  bottom: 24px;
  left: 24px;
  max-width: 240px;
}

.coords-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.coords-icon {
  color: var(--color-primary);
  font-size: 16px;
}

.coords-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.coords-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.coord-label {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
}

.coord-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.hud-bottom-right {
  position: absolute;
  bottom: 24px;
  right: 340px;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
}

.status-group {
  display: flex;
  flex-direction: column;
}

.status-label {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.armed-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dc2626;
  animation: pulse-dot 2s infinite ease-in-out;
}

.armed-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-error);
}

.status-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary);
}

.status-divider {
  width: 1px;
  height: 32px;
  background: var(--color-outline-variant);
}

/* Camera sidebar */
.camera-sidebar {
  width: 320px;
  background: rgba(28, 32, 39, 0.6);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--color-outline-variant);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.sidebar-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
}

.param-group {
  margin-bottom: 8px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.param-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.param-value {
  font-size: 14px;
  color: var(--color-primary);
}

.param-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-surface-variant);
  height: 4px;
  border-radius: 2px;
  cursor: pointer;
}

.param-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
}

.param-range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  font-family: 'JetBrains Mono', monospace;
}

.focus-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.focus-btn {
  background: var(--color-surface-variant);
  border: none;
  border-radius: 4px;
  padding: 8px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.focus-btn:hover {
  background: var(--color-outline-variant);
}

.flex-1 { flex: 1; }

.zoom-buttons {
  display: flex;
  gap: 4px;
}

.zoom-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.zoom-btn:hover {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.zoom-btn.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.sidebar-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.action-btn:hover { opacity: 0.9; }
.action-btn:active { transform: scale(0.95); }

.action-btn.primary {
  background: var(--color-primary);
  color: var(--color-on-primary-container);
}

.action-btn.secondary {
  background: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
}

.action-btn.secondary:hover {
  background: var(--color-outline-variant);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
</style>
