/**
 * 跨模块共享的纯常量。
 * 业务侧默认值/Schema 请放各自的 settings 配置文件，此处只放数值/枚举字面量。
 */

/** 轻量 settings（相机、RS232 工作台）持久化防抖窗口 */
export const LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS = 400

/** 重量级 settings（控制器参数）持久化防抖窗口 */
export const HEAVY_SETTINGS_PERSIST_DEBOUNCE_MS = 800

/** 控制器参数下发驱动器的防抖窗口 */
export const DRIVER_SYNC_DEBOUNCE_MS = 1000

/** 固定 9 组数字量 I/O */
export const IO_MAP_GROUP_COUNT = 9 as const
