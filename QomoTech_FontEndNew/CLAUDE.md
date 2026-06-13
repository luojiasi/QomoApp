# CLAUDE.md

## Project

QomoTech — Electron + Vue 3 + TypeScript industrial precision control system.
Electron 39 + Vue 3.5 + Vite 7 + electron-builder 26.

## L10N Reactivity

The l10n engine uses Vue `ref` internally (`currentLocale`). When the user changes
language in Settings, ALL components re-render with new translations automatically.
No page refresh needed. No watchers needed in consumer components.

Import: `import { useL10n } from '../shared/l10n'` then `const { t } = useL10n()`.

## Conventions (MANDATORY)

### Every change must update these in sync:

0. **ALL page text must use l10n** — Monitor, Control, Recipes, Serial pages
   - Every user-visible string in every page component MUST use `t('path.to.key')`
   - No hardcoded Chinese/English/Japanese/Korean strings in any page template or script
   - When adding new page text: add keys to all 4 l10n files, then use `t()` in the component
   - This applies to ALL pages: Monitor, Control, Recipes, Serial, Settings

1. **l10n** — `src/renderer/src/shared/l10n/*.ts` (zh-CN, en, ja, ko)
   - Any new user-facing text MUST be added to all 4 locale files
   - Use the `t('path.to.key')` pattern, never hardcode strings in components
   - `t()` is reactive via Vue `ref` — language switch propagates instantly to ALL pages
   - Import via `import { useL10n } from '../shared/l10n'` then `const { t } = useL10n()`

2. **UpdateInfo** — `src/renderer/src/shared/components/UpdateInfo.vue` + l10n `update.vXXX` keys
   - **EVERY COMMIT that changes code MUST add a version entry here**
   - Add a new version entry in the `changes` map for the current version (dot-removed key, e.g. `0.1.12` → `v0112`)
   - Add corresponding `update.v0112.*` keys in all 4 l10n files (section inside the `update` block)
   - Add a `changelog.v0112` key in all 4 l10n files
   - Add version to `releaseOrder` array (newest first)
   - Date format: `YYYY-MM-DD`

3. **All settings MUST be real system data, never static**
   - Settings page reads via `window.api.system.getInfo()` from main process IPC
   - Window size, platform, arch — all live from the system
   - `app.getName()`, `app.getVersion()`, `process.platform`, `process.arch`, `BrowserWindow.getBounds()`

4. **Theme system** — `src/renderer/src/shared/theme/index.ts`
   - Three presets: `dark-industrial`, `arctic-blue`, `emerald-forest`
   - `applyTheme(id)` sets CSS variables on `:root` directly
   - Saved to `localStorage('qomotech:theme')`, restored on mount in App.vue
   - When adding a new theme, add the `nameKey` to all 4 l10n files under `settings.`

### Code style

- No comments unless the WHY is non-obvious
- `appearance: none` always paired with `-webkit-appearance: none`
- CSS variables from `:root` design system, no hardcoded hex colors in components
- TypeScript strict: no unused imports, no `any` without reason

### File structure

- `src/renderer/src/pages/` — route-level page components
- `src/renderer/src/shared/components/` — reusable UI components
- `src/renderer/src/shared/l10n/` — translation files + `index.ts` (i18n engine)
- `src/renderer/src/shared/theme/` — theme definitions + `index.ts` (3 presets, `applyTheme()`)
- `src/renderer/src/shared/serial/` — RS232 types, config, API HTTP endpoints, polling composable
- `src/renderer/src/router/` — Vue Router config
- `src/main/` — Electron main process
- `src/preload/` — context bridge APIs

### Backend communication

- Serial page uses `src/renderer/src/shared/serial/` for RS232 backend communication
- API endpoints: `rs232/ports` (list), `rs232/open` (connect), `rs232/close`, `rs232/send`, `rs232/buffer`
- Backend base URL: `http://127.0.0.1:5000` — edit in `shared/serial/api.ts`
- COM ports auto-detected every 3s when not connected via `watch(isConnected)`
- Settings serial defaults should sync with this config

```bash
npm run dev            # development with HMR
npm run build:win      # production Windows build
npm run typecheck      # full type check before commit
```

### Update testing

```bash
# 1. Build current version
npm run build:win

# 2. Serve dist/ as update server
npx serve ./dist -l 3000

# 3. Bump version in package.json, rebuild
# 4. Installed old version checks http://localhost:3000/latest.yml
```

## Current State (v0.2.10)

**Serial page**: COM auto-detection (3s poll), real-time terminal, TX/RX stats. Backend at `http://127.0.0.1:5000`. `connect-src` CSP allows backend fetch. Reconnect protection via `isConnecting` flag. Flow control removed. COM1-COM10 always shown, backend ports merged in. Buffer poll uses `clear=true` to get incremental data only — no duplicate lines.

**Known issue**: CSP `connect-src` was missing `http://127.0.0.1:5000` — fixed. **Dev only** — packaged app runs on `file://` protocol which has no CSP restrictions on Electron.

**Update flow**: `autoDownload: false` — check only on mount, download only on user click. Current version via `window.api.system.getInfo()` — never hardcoded. "Update Later" dismisses modal.
