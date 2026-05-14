import { ref } from 'vue'
import { apiCall } from '@/shared/api/httpClient'
import type { CommonOnlineCommand } from '../../index'
import {
  commonOnlineCommandsData,
  resolveOnlineCommandResultText,
  formatOnlineCommandResultByCommand
} from '@/shared/utils/onlineCommand'

type UseMotionExecuteOptions = {
  success?: (title: string, message?: string) => void
  error?: (title: string, message?: string) => void
}

export function useMotionExecute(options: UseMotionExecuteOptions = {}) {
  const onlineCommandInput = ref('')
  const onlineCommandResult = ref('')
  const onlineCommandPending = ref(false)
  const commonOnlineCommands = commonOnlineCommandsData
  const selectedCommonOnlineCommand = ref<CommonOnlineCommand | null>(null)

  function applyCommonOnlineCommand(item: CommonOnlineCommand): void {
    onlineCommandInput.value = item.command
    selectedCommonOnlineCommand.value = item
  }

  async function handleSendOnlineCommand(): Promise<void> {
    const command = onlineCommandInput.value.trim()
    if (!command) {
      options.error?.('在线命令为空', '请输入在线命令后再发送')
      return
    }

    onlineCommandPending.value = true
    try {
      const res = await apiCall<Record<string, unknown> | string>(
        'motion/cmd',
        'POST',
        { command } as Record<string, unknown>
      )
      if (!res?.success) {
        const rawText = resolveOnlineCommandResultText(res?.data, res?.message ?? '在线命令执行失败')
        onlineCommandResult.value = formatOnlineCommandResultByCommand(command, rawText)
        return
      }

      const rawText = resolveOnlineCommandResultText(res?.data, res?.message ?? '在线命令执行成功')
      onlineCommandResult.value = formatOnlineCommandResultByCommand(command, rawText)
      options.success?.('在线命令已发送', '执行成功')
    } finally {
      onlineCommandPending.value = false
    }
  }

  async function handleOpenOnlineCommandDoc(): Promise<void> {
    const res = await window.api.openDocument('resources/RTBasic.chm')
    if (!res.ok) {
      options.error?.('打开文档失败', res.error)
      return
    }
    options.success?.('已打开文档', 'RTBasic.chm')
  }

  return {
    onlineCommandInput,
    onlineCommandResult,
    onlineCommandPending,
    commonOnlineCommands,
    selectedCommonOnlineCommand,
    applyCommonOnlineCommand,
    handleSendOnlineCommand,
    handleOpenOnlineCommandDoc
  }
}
