<script setup lang="ts">
import { ref } from 'vue'

const activeRecipe = ref('Titanium Cutting')
const laserPower = ref(3250)

interface Recipe {
  name: string
  version: string
  type: string
  active: boolean
}

const recipes: Recipe[] = [
  { name: 'Titanium Cutting', version: 'v4.2', type: '5-Axis Fiber', active: true },
  { name: 'Steel Engraving', version: 'v1.0', type: 'CO2 Marking', active: false },
  { name: 'Aluminum Profiling', version: 'v2.1', type: 'High Precision', active: false },
  { name: 'Copper Heat Sink', version: 'v3.5', type: 'High Reflective', active: false }
]
</script>

<template>
  <div class="recipes-page">
    <!-- Recipe list sidebar -->
    <aside class="recipe-sidebar">
      <div class="recipe-sidebar-header">
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input type="text" class="search-input" placeholder="SEARCH RECIPES..." />
        </div>
        <div class="recipe-actions">
          <button class="recipe-action-btn">
            <span class="material-symbols-outlined">add</span>
            New
          </button>
          <button class="recipe-action-btn">
            <span class="material-symbols-outlined">file_upload</span>
            Import
          </button>
        </div>
      </div>

      <div class="recipe-list">
        <button
          v-for="recipe in recipes"
          :key="recipe.name"
          class="recipe-item"
          :class="{ active: recipe.active }"
          @click="activeRecipe = recipe.name"
        >
          <div class="recipe-item-header">
            <span class="recipe-name" :class="{ 'text-primary': recipe.active }">{{ recipe.name }}</span>
            <span class="recipe-version">{{ recipe.version }}</span>
          </div>
          <div class="recipe-type">
            <span class="material-symbols-outlined recipe-type-icon">precision_manufacturing</span>
            <span class="recipe-type-text">{{ recipe.type }}</span>
          </div>
        </button>

        <div class="recipe-empty">
          <div class="recipe-empty-box">
            <span class="material-symbols-outlined empty-icon">add_circle</span>
            <span class="empty-text">CREATE CUSTOM TEMPLATE</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Parameter editor -->
    <div class="recipe-editor">
      <div class="editor-inner">
        <!-- Header -->
        <div class="editor-header">
          <div>
            <nav class="breadcrumb">
              <span>Library</span>
              <span class="material-symbols-outlined breadcrumb-sep">chevron_right</span>
              <span>Metal Fab</span>
              <span class="material-symbols-outlined breadcrumb-sep">chevron_right</span>
              <span class="text-primary">Titanium Cutting</span>
            </nav>
            <h2 class="editor-title">
              {{ activeRecipe }}
              <span class="editor-id">#TC-992-B</span>
            </h2>
          </div>
          <div class="editor-toolbar">
            <button class="toolbar-btn">
              <span class="material-symbols-outlined">content_copy</span> CLONE
            </button>
            <button class="toolbar-btn">
              <span class="material-symbols-outlined">download</span> LOAD
            </button>
            <button class="toolbar-btn primary">
              <span class="material-symbols-outlined filled">save</span> SAVE CHANGES
            </button>
          </div>
        </div>

        <!-- Parameter grid -->
        <div class="param-grid">
          <div class="param-main">
            <!-- Primary controls -->
            <div class="param-cards">
              <div class="param-card">
                <div class="param-card-header">
                  <div>
                    <span class="param-card-label text-primary">Laser Power</span>
                    <span class="param-card-desc">Continuous Wave Output</span>
                  </div>
                  <span class="material-symbols-outlined text-primary">bolt</span>
                </div>
                <div class="param-card-value">
                  <span class="param-big-value">{{ laserPower }}</span>
                  <span class="param-card-unit">WATTS</span>
                </div>
                <input v-model.number="laserPower" type="range" min="0" max="6000" class="param-slider" />
                <div class="param-range-labels">
                  <span>0W</span>
                  <span>MAX 6.0kW</span>
                </div>
              </div>

              <div class="param-card">
                <div class="param-card-header">
                  <div>
                    <span class="param-card-label text-tertiary">Frequency</span>
                    <span class="param-card-desc">Modulation Pulse Rate</span>
                  </div>
                  <span class="material-symbols-outlined text-tertiary">graphic_eq</span>
                </div>
                <div class="param-card-value">
                  <span class="param-big-value">15.4</span>
                  <span class="param-card-unit">KHZ</span>
                </div>
                <div class="freq-buttons">
                  <button class="freq-btn">- 0.1</button>
                  <button class="freq-btn">+ 0.1</button>
                </div>
              </div>
            </div>

            <!-- Secondary -->
            <div class="param-cards">
              <div class="param-card">
                <div class="param-card-header">
                  <span class="param-card-label">Pulse Width</span>
                  <div class="pulse-badge">
                    <span>500</span>
                    <span class="pulse-unit">µs</span>
                  </div>
                </div>
                <div class="pulse-viz">
                  <div class="pulse-bar"></div>
                  <div class="pulse-active"></div>
                  <div class="pulse-bar"></div>
                  <div class="pulse-active"></div>
                  <div class="pulse-bar"></div>
                </div>
                <p class="pulse-duty">CURRENT DUTY CYCLE: 42%</p>
              </div>

              <div class="param-card">
                <div class="param-card-header">
                  <span class="param-card-label">Feed Rate</span>
                  <span class="material-symbols-outlined param-card-icon">speed</span>
                </div>
                <div class="feed-control">
                  <button class="feed-btn"><span class="material-symbols-outlined">remove_circle_outline</span></button>
                  <span class="feed-value">1,200</span>
                  <button class="feed-btn"><span class="material-symbols-outlined">add_circle_outline</span></button>
                </div>
                <span class="feed-unit">MM / MIN</span>
              </div>
            </div>

            <!-- Fine tuning table -->
            <div class="param-table-card">
              <div class="table-header">
                <span class="table-title">Fine-Tuning Matrix</span>
                <span class="material-symbols-outlined table-more">more_horiz</span>
              </div>
              <table class="param-table">
                <thead>
                  <tr>
                    <th>Coordinate Path</th>
                    <th class="text-right">Offset (mm)</th>
                    <th class="text-right">Accel. (g)</th>
                    <th class="text-center">Assist Gas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Inner Contour A</td>
                    <td class="text-right">0.045</td>
                    <td class="text-right">1.2</td>
                    <td class="text-center"><span class="gas-tag">N2</span></td>
                    <td><span class="status-optimal"></span>Optimal</td>
                  </tr>
                  <tr>
                    <td>Outer Perimeter</td>
                    <td class="text-right">0.120</td>
                    <td class="text-right">0.8</td>
                    <td class="text-center"><span class="gas-tag">O2</span></td>
                    <td><span class="status-optimal"></span>Optimal</td>
                  </tr>
                  <tr>
                    <td>Lead-in 01</td>
                    <td class="text-right">-0.010</td>
                    <td class="text-right">0.5</td>
                    <td class="text-center"><span class="gas-tag">N2</span></td>
                    <td><span class="status-warning"></span>Warning</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Material sidebar -->
          <div class="param-sidebar">
            <div class="material-card">
              <span class="material-card-title">Material Specification</span>
              <div class="material-info">
                <div class="material-thumb">
                  <div class="material-thumb-placeholder">Ti</div>
                </div>
                <div>
                  <h4 class="material-name">Ti-6Al-4V</h4>
                  <p class="material-desc">Grade 5 Aerospace Titanium</p>
                </div>
              </div>
              <div class="material-specs">
                <div class="spec-row">
                  <span class="spec-label">Thickness</span>
                  <span class="spec-value">6.35 mm</span>
                </div>
                <div class="spec-row">
                  <span class="spec-label">Reflectivity</span>
                  <span class="spec-value">Low (22%)</span>
                </div>
                <div class="spec-row">
                  <span class="spec-label">Thermal Conductivity</span>
                  <span class="spec-value">6.7 W/mK</span>
                </div>
              </div>
            </div>

            <div class="viz-card">
              <span class="viz-title">Path Visualization</span>
              <div class="viz-canvas">
                <div class="viz-placeholder">PATH VIEW</div>
              </div>
              <div class="viz-buttons">
                <button class="viz-btn">TOP VIEW</button>
                <button class="viz-btn">ISO</button>
                <button class="viz-btn">G-CODE</button>
              </div>
            </div>

            <div class="safety-card">
              <div class="safety-header">
                <span class="material-symbols-outlined safety-icon">warning</span>
                <span class="safety-title">Safety Constraints</span>
              </div>
              <p class="safety-text">
                The current 3250W setting exceeds recommended air-cooled nozzle limit.
                Ensure liquid cooling circuit 2 is active before cycle start.
              </p>
              <label class="safety-toggle">
                <input type="checkbox" />
                <span class="toggle-slider"></span>
                <span class="toggle-label">Override Safety Interlock</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipes-page {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Recipe sidebar */
.recipe-sidebar {
  width: 320px;
  background: var(--color-surface-container-low);
  border-right: 1px solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.recipe-sidebar-header {
  padding: 16px;
}

.search-box {
  position: relative;
  margin-bottom: 8px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-outline);
  font-size: 16px;
}

.search-input {
  width: 100%;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  padding: 8px 8px 8px 40px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.recipe-actions {
  display: flex;
  gap: 4px;
}

.recipe-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  transition: background 0.2s;
}

.recipe-action-btn:hover {
  background: var(--color-surface-variant);
}

.recipe-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

.recipe-item {
  width: 100%;
  text-align: left;
  padding: 16px;
  border: none;
  border-left: 4px solid transparent;
  border-radius: 0 4px 4px 0;
  background: none;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.recipe-item:hover {
  background: var(--color-surface-variant);
}

.recipe-item.active {
  background: rgba(73, 76, 80, 0.3);
  border-left-color: var(--color-primary);
}

.recipe-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.recipe-name {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.text-primary { color: var(--color-primary); }

.recipe-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 2px;
  background: rgba(173, 199, 255, 0.1);
  color: rgba(173, 199, 255, 0.7);
}

.recipe-type {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-on-surface-variant);
}

.recipe-type-icon { font-size: 12px; }

.recipe-type-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
}

.recipe-empty {
  padding: 16px;
}

.recipe-empty-box {
  height: 128px;
  border: 2px dashed var(--color-outline-variant);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  color: var(--color-on-surface-variant);
}

.recipe-empty-box:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.empty-icon { font-size: 32px; }

.empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

/* Editor */
.recipe-editor {
  flex: 1;
  background: var(--color-background);
  overflow-y: auto;
}

.editor-inner {
  padding: 32px;
  max-width: 1280px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid var(--color-outline-variant);
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.breadcrumb-sep { font-size: 10px; }

.editor-title {
  font-family: 'Inter', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-on-surface);
}

.editor-id {
  font-weight: 300;
  color: var(--color-outline);
  margin-left: 8px;
  font-size: 24px;
}

.editor-toolbar {
  display: flex;
  gap: 16px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  transition: background 0.2s;
}

.toolbar-btn:hover { background: var(--color-surface-variant); }

.toolbar-btn.primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
  font-weight: 700;
  padding: 8px 32px;
}

.toolbar-btn .filled {
  font-variation-settings: 'FILL' 1;
}

/* Param grid */
.param-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
}

.param-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.param-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.param-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  border-radius: 8px;
}

.param-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.param-card-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  display: block;
}

.text-primary { color: var(--color-primary); }
.text-tertiary { color: var(--color-tertiary); }

.param-card-desc {
  font-size: 14px;
  color: var(--color-on-surface-variant);
}

.param-card-value {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.param-big-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 600;
  color: var(--color-on-surface);
  line-height: 1;
}

.param-card-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-outline);
  padding-bottom: 4px;
}

.param-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-surface-container-highest);
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
  color: var(--color-outline);
  font-family: 'JetBrains Mono', monospace;
}

.freq-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.freq-btn {
  padding: 4px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  cursor: pointer;
}

.freq-btn:hover { background: var(--color-surface-variant); }

.param-card-icon { color: var(--color-secondary); }

.pulse-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
}

.pulse-unit { color: var(--color-outline); font-size: 10px; }

.pulse-viz {
  height: 64px;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  padding: 4px;
}

.pulse-bar {
  flex: 1;
  background: var(--color-outline-variant);
  height: 8px;
}

.pulse-active {
  width: 32px;
  background: var(--color-primary);
  height: 48px;
}

.pulse-duty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
  text-align: center;
  margin-top: 8px;
}

.feed-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 8px;
}

.feed-btn {
  background: none;
  border: none;
  color: var(--color-outline);
  cursor: pointer;
}

.feed-btn:hover { color: var(--color-primary); }

.feed-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-on-surface);
}

.feed-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-outline);
  display: block;
  text-align: center;
}

/* Table */
.param-table-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 24px;
  background: var(--color-surface-container-high);
  border-bottom: 1px solid var(--color-outline-variant);
}

.table-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-transform: uppercase;
}

.table-more { color: var(--color-outline); font-size: 16px; }

.param-table {
  width: 100%;
  text-align: left;
  font-family: 'JetBrains Mono', monospace;
}

.param-table thead {
  background: var(--color-surface-container);
  color: var(--color-outline);
  font-size: 11px;
  text-transform: uppercase;
}

.param-table th {
  padding: 12px 24px;
  font-weight: 500;
}

.param-table td {
  padding: 8px 24px;
  font-size: 12px;
  color: var(--color-on-surface);
}

.param-table tbody tr {
  border-top: 1px solid rgba(65, 71, 84, 0.3);
}

.param-table tbody tr:hover {
  background: rgba(49, 53, 61, 0.3);
}

.text-right { text-align: right; }
.text-center { text-align: center; }

.gas-tag {
  background: rgba(196, 198, 203, 0.1);
  color: var(--color-secondary);
  border: 1px solid rgba(196, 198, 203, 0.3);
  padding: 2px 4px;
  border-radius: 2px;
}

.status-optimal, .status-warning {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}

.status-optimal { background: var(--color-primary); }
.status-warning { background: var(--color-tertiary); }

/* Sidebar */
.param-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.material-card, .viz-card, .safety-card {
  background: rgba(36, 39, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  border-radius: 8px;
}

.material-card-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  text-transform: uppercase;
  display: block;
  border-bottom: 1px solid var(--color-outline-variant);
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.material-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.material-thumb {
  width: 64px;
  height: 64px;
  background: var(--color-surface-container-highest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.material-thumb-placeholder {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-on-surface-variant);
}

.material-name {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.material-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}

.material-specs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.spec-label { color: var(--color-outline); }
.spec-value { color: var(--color-on-surface); }

.viz-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface);
  text-transform: uppercase;
  display: block;
  border-bottom: 1px solid var(--color-outline-variant);
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.viz-canvas {
  aspect-ratio: 1;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.viz-placeholder {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
  letter-spacing: 0.1em;
}

.viz-buttons {
  display: flex;
  gap: 8px;
}

.viz-btn {
  flex: 1;
  padding: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 4px;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.viz-btn:hover { background: var(--color-surface-variant); }

.safety-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.safety-icon { color: var(--color-error); }

.safety-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-error);
}

.safety-text {
  font-size: 14px;
  color: var(--color-on-error-container);
  margin-bottom: 16px;
}

.safety-toggle {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
}

.safety-toggle input {
  width: 44px;
  height: 24px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-surface-container-highest);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  border: none;
}

.safety-toggle input:checked {
  background: var(--color-primary);
}

.safety-toggle input::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
}

.safety-toggle input:checked::after {
  transform: translateX(20px);
}

.toggle-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
}
</style>
