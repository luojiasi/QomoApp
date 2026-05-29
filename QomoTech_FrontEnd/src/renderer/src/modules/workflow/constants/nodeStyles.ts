// ─────────────────────────────────────────────────────────────
// constants/nodeStyles.ts — 节点分类视觉样式常量
//
// 每个 NodeCategory 对应一套视觉配置：
//   - color      → 卡片头部背景色 (hex/tailwind arbitrary)
//   - textColor  → 头部文字/图标颜色
//   - ringColor  → 选中时的外圈光晕颜色
//   - fallback   → 节点定义未提供 icon 时的备用图标
// ─────────────────────────────────────────────────────────────

import type { NodeCategory } from '../types/nodeDefinition'

export interface NodeCategoryStyle {
  /** 头部背景色，使用 CSS 变量或 hex */
  headerBg: string
  /** 头部图标/文字颜色 */
  headerText: string
  /** 选中时外圈光晕颜色（rgba） */
  ringColor: string
  /** 无 icon 时显示的备用 emoji */
  fallbackIcon: string
}

export const NODE_CATEGORY_STYLES: Record<NodeCategory, NodeCategoryStyle> = {
  trigger: {
    headerBg: '#7c3aed',     // violet-700
    headerText: '#ede9fe',   // violet-100
    ringColor: 'rgba(124,58,237,0.35)',
    fallbackIcon: '▶'
  },
  motion: {
    headerBg: '#1d4ed8',     // blue-700
    headerText: '#dbeafe',   // blue-100
    ringColor: 'rgba(29,78,216,0.35)',
    fallbackIcon: '↗'
  },
  rs232: {
    headerBg: '#a16207',     // yellow-700
    headerText: '#fef9c3',   // yellow-100
    ringColor: 'rgba(161,98,7,0.35)',
    fallbackIcon: '⚡'
  },
  camera: {
    headerBg: '#0f766e',     // teal-700
    headerText: '#ccfbf1',   // teal-100
    ringColor: 'rgba(15,118,110,0.35)',
    fallbackIcon: '📷'
  },
  flow: {
    headerBg: '#c2410c',     // orange-700
    headerText: '#ffedd5',   // orange-100
    ringColor: 'rgba(194,65,12,0.35)',
    fallbackIcon: '⊕'
  },
  data: {
    headerBg: '#0e7490',     // cyan-700
    headerText: '#cffafe',   // cyan-100
    ringColor: 'rgba(14,116,144,0.35)',
    fallbackIcon: '◈'
  },
  test: {
    headerBg: '#a21caf',     // fuchsia-700
    headerText: '#fae8ff',   // fuchsia-100
    ringColor: 'rgba(162,28,175,0.35)',
    fallbackIcon: '⚙'
  },
  recipe: {
    headerBg: '#7c3aed',     // violet-700
    headerText: '#ede9fe',   // violet-100
    ringColor: 'rgba(124,58,237,0.35)',
    fallbackIcon: '📋'
  }
}
