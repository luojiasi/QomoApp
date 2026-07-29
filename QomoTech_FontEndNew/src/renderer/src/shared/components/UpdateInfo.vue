<script setup lang="ts">
import { ref } from 'vue'
import { useL10n } from '../l10n'

const { t } = useL10n()

interface VersionChange {
  type: 'feature' | 'fix' | 'improve' | 'breaking'
  textKey: string
}

interface VersionRelease {
  version: string
  date: string
  titleKey: string
  changeKeys: string[]
}

const changes: Record<string, VersionChange[]> = {
  '0.2.15': [
    { type: 'feature', textKey: 'update.v0215.c1' },
    { type: 'improve', textKey: 'update.v0215.c2' },
    { type: 'improve', textKey: 'update.v0215.c3' },
    { type: 'fix', textKey: 'update.v0215.c4' }
  ],
  '0.2.14': [
    { type: 'improve', textKey: 'update.v0214.c1' },
    { type: 'feature', textKey: 'update.v0214.c2' },
    { type: 'feature', textKey: 'update.v0214.c3' },
    { type: 'fix', textKey: 'update.v0214.c4' }
  ],
  '0.2.13': [
    { type: 'feature', textKey: 'update.v0213.c1' },
    { type: 'feature', textKey: 'update.v0213.c2' },
    { type: 'improve', textKey: 'update.v0213.c3' },
    { type: 'improve', textKey: 'update.v0213.c4' }
  ],
  '0.2.12': [
    { type: 'feature', textKey: 'update.v0212.c1' },
    { type: 'feature', textKey: 'update.v0212.c2' },
    { type: 'feature', textKey: 'update.v0212.c3' },
    { type: 'improve', textKey: 'update.v0212.c4' }
  ],
  '0.2.11': [
    { type: 'feature', textKey: 'update.v0211.c1' },
    { type: 'feature', textKey: 'update.v0211.c2' },
    { type: 'feature', textKey: 'update.v0211.c3' },
    { type: 'improve', textKey: 'update.v0211.c4' }
  ],
  '0.2.10': [
    { type: 'fix', textKey: 'update.v0210.c1' },
    { type: 'fix', textKey: 'update.v0210.c2' },
    { type: 'improve', textKey: 'update.v0210.c3' },
    { type: 'improve', textKey: 'update.v0210.c4' }
  ],
  '0.2.9': [
    { type: 'feature', textKey: 'update.v029.c1' },
    { type: 'fix', textKey: 'update.v029.c2' },
    { type: 'fix', textKey: 'update.v029.c3' },
    { type: 'improve', textKey: 'update.v029.c4' }
  ]
}

const releaseOrder = ['0.2.15', '0.2.14', '0.2.13', '0.2.12', '0.2.11', '0.2.10', '0.2.9']

const changelog: VersionRelease[] = releaseOrder.map((v) => ({
  version: v,
  date: t(`update.v${v.replace(/\./g, '')}.date`),
  titleKey: `changelog.v${v.replace(/\./g, '')}`,
  changeKeys: changes[v]?.map((c) => c.textKey) ?? []
}))

const visible = ref(false)

function toggle() {
  visible.value = !visible.value
}

function close() {
  visible.value = false
}

defineExpose({ toggle, close })

function typeIcon(type: VersionChange['type']): string {
  const map: Record<string, string> = {
    feature: 'add_circle',
    fix: 'build_circle',
    improve: 'tune',
    breaking: 'warning'
  }
  return map[type]
}

function getChange(release: VersionRelease, idx: number): VersionChange | null {
  return changes[release.version]?.[idx] ?? null
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" v-if="visible" @click.self="close">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title-row">
            <span class="material-symbols-outlined panel-icon">campaign</span>
            <h2 class="panel-title">{{ t('update.title') }}</h2>
          </div>
          <button class="close-btn" @click="close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="panel-body">
          <!-- Latest version highlight -->
          <div class="latest-card">
            <span class="latest-badge">{{ t('update.latestVersion') }}</span>
            <div class="latest-header">
              <span class="latest-version">v{{ changelog[0].version }}</span>
              <span class="latest-date">{{ changelog[0].date }}</span>
            </div>
            <h3 class="latest-title">{{ t(changelog[0].titleKey) }}</h3>
            <ul class="latest-changes">
              <li
                v-for="(key, i) in changelog[0].changeKeys"
                :key="i"
                :class="`change-item change-${getChange(changelog[0], i)?.type ?? 'feature'}`"
              >
                <span class="material-symbols-outlined change-icon">
                  {{ typeIcon(getChange(changelog[0], i)?.type ?? 'feature') }}
                </span>
                <span class="change-badge">
                  {{ t(`update.type${getChange(changelog[0], i)?.type === 'feature' ? 'Feature' : getChange(changelog[0], i)?.type === 'fix' ? 'Fix' : getChange(changelog[0], i)?.type === 'improve' ? 'Improve' : 'Breaking'}`) }}
                </span>
                <span class="change-text">{{ t(key) }}</span>
              </li>
            </ul>
          </div>

          <!-- All versions -->
          <div class="timeline">
            <div
              v-for="(release, idx) in changelog"
              :key="release.version"
              class="timeline-item"
            >
              <div class="timeline-marker">
                <div class="timeline-dot" :class="{ current: idx === 0 }"></div>
                <div class="timeline-line" v-if="idx < changelog.length - 1"></div>
              </div>

              <div class="timeline-card" :class="{ current: idx === 0 }">
                <div class="timeline-card-header">
                  <span class="tl-version">v{{ release.version }}</span>
                  <span class="tl-date">{{ release.date }}</span>
                </div>
                <h4 class="tl-title">{{ t(release.titleKey) }}</h4>
                <ul class="tl-changes">
                  <li
                    v-for="(key, ci) in release.changeKeys"
                    :key="ci"
                    :class="`tl-change tl-${getChange(release, ci)?.type ?? 'feature'}`"
                  >
                    <span class="tl-change-dot"></span>
                    {{ t(key) }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* styles unchanged — keeping the existing scoped CSS */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.panel {
  width: 620px;
  max-height: 80vh;
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--color-surface-container);
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-icon {
  font-size: 24px;
  color: var(--color-primary);
}

.panel-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--color-surface-variant);
}

.panel-body {
  overflow-y: auto;
  padding: 24px;
  flex: 1;
}

.latest-card {
  background: rgba(173, 199, 255, 0.06);
  border: 1px solid rgba(173, 199, 255, 0.2);
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 28px;
  position: relative;
}

.latest-badge {
  position: absolute;
  top: -10px;
  left: 20px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
}

.latest-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
  margin-top: 4px;
}

.latest-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
}

.latest-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-on-surface-variant);
}

.latest-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 14px;
}

.latest-changes {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.change-icon { font-size: 16px; }

.change-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
  font-weight: 500;
}

.change-feature .change-icon { color: #4ade80; }
.change-feature .change-badge { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

.change-fix .change-icon { color: var(--color-tertiary); }
.change-fix .change-badge { background: rgba(255, 182, 149, 0.15); color: var(--color-tertiary); }

.change-improve .change-icon { color: var(--color-primary); }
.change-improve .change-badge { background: rgba(173, 199, 255, 0.15); color: var(--color-primary); }

.change-breaking .change-icon { color: var(--color-error); }
.change-breaking .change-badge { background: rgba(255, 180, 171, 0.15); color: var(--color-error); }

.change-text { color: var(--color-on-surface-variant); }

.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 16px;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-outline-variant);
  border: 2px solid var(--color-outline-variant);
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-dot.current {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 8px rgba(173, 199, 255, 0.5);
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--color-outline-variant);
  margin: 4px 0;
  min-height: 16px;
}

.timeline-card {
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-surface-container);
  border: 1px solid var(--color-outline-variant);
  margin-bottom: 12px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.timeline-card:hover { opacity: 0.85; }

.timeline-card.current {
  opacity: 1;
  border-color: rgba(173, 199, 255, 0.15);
}

.timeline-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tl-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.tl-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-on-surface-variant);
  margin-left: 12px;
}

.tl-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 10px;
}

.tl-changes {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tl-change {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tl-change-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.tl-feature .tl-change-dot { background: #4ade80; }
.tl-fix .tl-change-dot { background: var(--color-tertiary); }
.tl-improve .tl-change-dot { background: var(--color-primary); }
.tl-breaking .tl-change-dot { background: var(--color-error); }
</style>
