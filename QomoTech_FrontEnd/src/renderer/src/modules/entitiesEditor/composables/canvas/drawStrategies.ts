import { EntityKind } from "../../commons/types";


/** 字段类型：point=点（画布点击/坐标输入）、number=数值输入、multiPoint=多点追加*/
export type FieldKind = 'point' | 'number' | 'multiPoint' | 'toggle'
export interface FieldDef {
    id: string                     // 字段标识（策略内唯一）
    label: string                  // UI 显示标签
    kind: FieldKind                // 前端渲染类型和交互方式
    default?: number | boolean     // number/toggle 的默认值
  }

// ── 策略定义 ─────────────────────────────────────────────

export interface DrawStrategyDef {
    id: string                     // e.g. 'center-radius'
    label: string                  // e.g. '圆心+半径'
    default: boolean               // 工具栏左键是否使用此策略
    fields: FieldDef[]             // 参数列表（顺序即步骤顺序）
  }
// ── 策略注册表 ───────────────────────────────────────────
export const DRAW_STRATEGIES: Record<EntityKind, DrawStrategyDef[]> = {
    LINE: [
        {
            id: 'two-point', label: '两点', default: true,
            fields: [
                { id: 'start', label: '起点', kind: 'point' },
                { id: 'end',   label: '终点', kind: 'point' },
            ],
        },
    ],
    ARC: [
        {
            id: 'center-radius-angle', label: '圆心——起点——终点', default: true,
            fields: [
                { id: 'center', label: '圆心', kind: 'point' },
                { id: 'start',  label: '起点', kind: 'point' },
                { id: 'end',    label: '终点', kind: 'point' },
            ],
        },
    ],
    CIRCLE: [
        {
            id: 'two-point', label: '圆心+半径', default: true,
            fields: [
              { id: 'center', label: '圆心', kind: 'point' },
              { id: 'P2',     label: '半径点', kind: 'point' },
            ],
        },
        {
            id: 'three-point', label: '三点', default: false,
            fields: [
              { id: 'P1', label: 'P1', kind: 'point' },
              { id: 'P2', label: 'P2', kind: 'point' },
              { id: 'P3', label: 'P3', kind: 'point' },
            ],
        },
    ],
    POLYLINE: [
        {
          id: 'vertices', label: '逐点连接', default: true,
          fields: [
            { id: 'vertices', label: '顶点', kind: 'multiPoint' },
            { id: 'closed',   label: '闭合', kind: 'toggle', default: false },
          ],
        },
    ],
    BEZIER: [
        {
            id: 'control-points', label: '控制点', default: true,
            fields: [
                { id: 'points', label: '控制点', kind: 'multiPoint' },
            ],
        },
    ],
    ELLIPSE: [
        {
            id: 'center-axes', label: '圆心+短轴+长轴', default: true,
            fields: [
                { id: 'center',    label: '圆心', kind: 'point' },
                { id: 'shortAxis', label: '短轴', kind: 'point' },
                { id: 'longAxis',  label: '长轴', kind: 'point' },
            ],
        },
    ],
    DIAMOND: [
        {
            id: 'two-point', label: '圆心+半径', default: true,
            fields: [
                { id: 'center', label: '圆心', kind: 'point' },
                { id: 'P2',     label: '半径点', kind: 'point' },
            ],
        },
    ],
}


/** 获取某图元的默认策略（左键点击时使用） */
export function getDefaultStrategy(kind: EntityKind): DrawStrategyDef {
    return DRAW_STRATEGIES[kind].find(s => s.default) ?? DRAW_STRATEGIES[kind][0]
}
// /** 按 id 查找某图元的特定策略 */
export function getStrategy(kind: EntityKind, strategyId: string): DrawStrategyDef | undefined {
    return DRAW_STRATEGIES[kind].find(s => s.id === strategyId)
}
/** 获取某图元的全部策略列表（用于右键菜单） */
export function getStrategies(kind: EntityKind): DrawStrategyDef[] {
    return DRAW_STRATEGIES[kind]
}