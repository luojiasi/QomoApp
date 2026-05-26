// ─────────────────────────────────────────────────────────────
// infra/canvasKeyboardBridge.ts — 画布键盘事件桥接
// ─────────────────────────────────────────────────────────────

export function registerCanvasKeydown(handler: (e: KeyboardEvent) => void): () => void {
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
