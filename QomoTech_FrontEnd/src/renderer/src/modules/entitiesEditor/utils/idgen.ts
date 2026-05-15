// =============================================================================
// 简易 ID 生成器
// =============================================================================

let _counter = 0

export function generateId(prefix = 'ent'): string {
  _counter++
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${rand}_${_counter}`
}
