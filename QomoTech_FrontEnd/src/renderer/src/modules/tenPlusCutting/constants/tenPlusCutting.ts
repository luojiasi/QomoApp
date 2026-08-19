export const TEN_PLUS_SLOT_COUNT = 10
export const TEN_PLUS_FILE_VERSION = '2.3.0'
export const TEN_PLUS_FILE_EXT = '.jjs'
export const TEN_PLUS_FILE_FORMAT = 'QOMO5P-FreeParamTargets' as const
export const LEGACY_TASK_TABLE_FORMAT = 'QOMO5P-TaskTable' as const

/** 网格显示顺序：左列 6–10，右列 1–5（行优先） */
export const TEN_PLUS_GRID_ORDER: number[] = [6, 1, 7, 2, 8, 3, 9, 4, 10, 5]

/** 工位夹具输出口：1/6→3，2/7→4，3/8→5，4/9→6，5/10→7 */
export const TEN_PLUS_STATION_OUTPUT_PORTS: readonly number[] = [3, 4, 5, 6, 7]

export function slotIndexToOutputPort(slotIndex: number): number | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > TEN_PLUS_SLOT_COUNT) {
    return null
  }
  return ((slotIndex - 1) % 5) + 3
}
