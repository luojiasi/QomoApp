import { type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { startProgramControl } from '../api'

  /** 程序运行控制：暂停/复位/急停/跳过操作封装。 */
export function useProgramControl(
  programRunning: Ref<boolean>,
  programPaused: Ref<boolean>,
  programTaskCount: Ref<number>,
  onAfterEstop: () => void
) {
  const { error, success } = useNotification()

  async function onPauseToggleClick(): Promise<void> {
    if (!programRunning.value) {
      error('当前没有运行中的程序。')
      return
    }
    const action = programPaused.value ? 'resume' : 'pause'
    const r = await startProgramControl(action)
    if (!r?.success) {
      error(r?.message || '暂停/继续操作失败。')
      return
    }
    success(r?.message || '已执行。')
  }

  async function onResetAlarmsClick(): Promise<void> {
    const r = await startProgramControl('reset')
    if (!r?.success) {
      error(r?.message || '复位清除报警失败。')
      return
    }
    success(r?.message || '报警已清除。')
  }

  async function onEstopClick(): Promise<void> {
    const r = await startProgramControl('estop')
    if (!r?.success) {
      error(r?.message || '急停指令失败。')
      return
    }
    success(r?.message || '已急停。')
    onAfterEstop()
  }

  async function onSkipTaskClick(): Promise<void> {
    if (programTaskCount.value < 2) return
    const r = await startProgramControl('skip')
    if (!r?.success) {
      error(r?.message || '跳过当前任务失败。')
      return
    }
    success(r?.message || '已请求跳过。')
  }

  return {
    onPauseToggleClick,
    onResetAlarmsClick,
    onEstopClick,
    onSkipTaskClick
  }
}
