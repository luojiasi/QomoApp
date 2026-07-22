import { computed, ref } from 'vue'
import { moveMotionAxisAbs } from '../api'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'

/** 单个采样点的状态 */
export type ThreePointsCircleSampleState = 'pending' | 'done'

/** 单个采样点 */
export interface ThreePointsCircleSample {
  id: number
  state: ThreePointsCircleSampleState
  X: number | null
  Y: number | null
  Z: number | null
}

/** 三点求圆心结果 */
export interface ThreePointsCircleResult {
  X: number
  Y: number
  radius: number
}

export function useThreePointsToFindCirclePoint() {
  const { error, success } = useNotification()
  const { mposition } = useHardwareState()

  /** 从硬件状态读取指定轴当前机械坐标 */
  function getAxisPosition(axisName: 'X' | 'Y' | 'Z'): number | null {
    const mpos = Number(mposition.value[axisName] ?? NaN)
    return Number.isFinite(mpos) ? mpos : null
  }

  /** 三个采样点 */
  const points = ref<ThreePointsCircleSample[]>([
    { id: 0, state: 'pending', X: null, Y: null, Z: null },
    { id: 1, state: 'pending', X: null, Y: null, Z: null },
    { id: 2, state: 'pending', X: null, Y: null, Z: null },
  ])

  /** 记录当前机械位置到指定采样点 */
  function recordPoint(index: number) {
    if (index < 0 || index > 2) {
      error('无效的点序号')
      return
    }

    const X = getAxisPosition('X')
    const Y = getAxisPosition('Y')
    const Z = getAxisPosition('Z')

    if (X === null || Y === null) {
      error('当前 XY 位置不可用，无法记录采样点')
      return
    }

    const newPoints = [...points.value]
    newPoints[index] = {
      id: index,
      state: 'done',
      X: Number(X.toFixed(3)),
      Y: Number(Y.toFixed(3)),
      Z: Z !== null ? Number(Z.toFixed(3)) : null,
    }
    points.value = newPoints

    success(`第 ${index + 1} 点已记录`)
  }

  /** 清除单个采样点 */
  function clearPoint(index: number) {
    if (index < 0 || index > 2) {
      error('无效的点序号')
      return
    }
    const newPoints = [...points.value]
    newPoints[index] = { id: index, state: 'pending', X: null, Y: null, Z: null }
    points.value = newPoints
  }

  /** 清空所有采样点 */
  function clearPoints() {
    points.value = [
      { id: 0, state: 'pending', X: null, Y: null, Z: null },
      { id: 1, state: 'pending', X: null, Y: null, Z: null },
      { id: 2, state: 'pending', X: null, Y: null, Z: null },
    ]
  }

  /** 三点是否已全部记录 */
  const allPointsDone = computed(() => points.value.every((p) => p.state === 'done'))

  /** 三点求圆心 —— 通过两条垂直平分线相交计算 */
  const circleCenter = computed<ThreePointsCircleResult | null>(() => {
    const [p1, p2, p3] = points.value
    if (p1.X === null || p1.Y === null || p2.X === null || p2.Y === null || p3.X === null || p3.Y === null) {
      return null
    }

    const x1 = p1.X, y1 = p1.Y
    const x2 = p2.X, y2 = p2.Y
    const x3 = p3.X, y3 = p3.Y

    // 垂直平分线方程组: a11*x + a12*y = b1, a21*x + a22*y = b2
    const a11 = x2 - x1
    const a12 = y2 - y1
    const b1 = (x2 * x2 - x1 * x1 + y2 * y2 - y1 * y1) / 2

    const a21 = x3 - x2
    const a22 = y3 - y2
    const b2 = (x3 * x3 - x2 * x2 + y3 * y3 - y2 * y2) / 2

    const det = a11 * a22 - a12 * a21

    // 三点共线 → 无解
    if (Math.abs(det) < 1e-10) {
      return null
    }

    const cx = (b1 * a22 - a12 * b2) / det
    const cy = (a11 * b2 - b1 * a21) / det
    const radius = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2)

    return {
      X: Number(cx.toFixed(3)),
      Y: Number(cy.toFixed(3)),
      radius: Number(radius.toFixed(3)),
    }
  })

  /** 是否正在移动到圆心 */
  const isMovingToCenter = ref(false)

  /** 移动 XY 到圆心位置 */
  async function moveToCenter() {
    const center = circleCenter.value
    if (!center) {
      error('请先记录三个点并计算出圆心')
      return
    }

    if (isMovingToCenter.value) {
      error('正在移动到圆心，请稍等')
      return
    }

    isMovingToCenter.value = true
    try {
      const resultX = await moveMotionAxisAbs(0, center.X)
      if (!resultX.success) {
        error(`X 轴移动失败: ${resultX.message}`)
        return
      }
      const resultY = await moveMotionAxisAbs(1, center.Y)
      if (!resultY.success) {
        error(`Y 轴移动失败: ${resultY.message}`)
        return
      }
      success('已移动到圆心位置')
    } catch (err) {
      const message = err instanceof Error ? err.message : '移动到圆心失败'
      error(message)
    } finally {
      isMovingToCenter.value = false
    }
  }

  /** 格式化坐标展示 */
  function formatCoord(value: number | null): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
  }

  return {
    points,
    allPointsDone,
    circleCenter,
    isMovingToCenter,
    recordPoint,
    clearPoint,
    clearPoints,
    moveToCenter,
    formatCoord,
  }
}
