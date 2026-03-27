# `renderer/` 目录说明

Electron **渲染进程** 的静态入口层，主要包含挂载 Vue 应用的 HTML。

## 文件一览

| 文件 | 用途 |
|------|------|
| `index.html` | 页面壳：`<div id="app">`、CSP、引入 `/src/main.ts` |

## 使用说明

- 开发模式下由 Vite 注入 `ELECTRON_RENDERER_URL` 加载；生产环境由主进程 `loadFile` 加载打包后的 `index.html`。
- 业务代码均在 `src/renderer/src/`（见该目录 `A.md`）。

## 修改 CSP

若需加载外部资源或内联脚本，需同步调整 `index.html` 中 `Content-Security-Policy`，并评估安全风险。
