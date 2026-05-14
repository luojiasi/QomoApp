import { watch, onUnmounted, type Ref } from 'vue'

const BUFFER_POLL_MS = 250

interface UseRs232PollingOptions {
  serialConnected: Ref<boolean>
  autoSendEnabled: Ref<boolean>
  autoSendIntervalMs: Ref<number>
  onPollBuffer: () => Promise<void>
  onAutoSend: () => Promise<void>
}

export function useRs232Polling(options: UseRs232PollingOptions) {
  const { serialConnected, autoSendEnabled, autoSendIntervalMs, onPollBuffer, onAutoSend } = options

  let bufferPollTimer: ReturnType<typeof setInterval> | null = null
  let autoSendTimer: ReturnType<typeof setInterval> | null = null

  function stopBufferPoll(): void {
    if (bufferPollTimer !== null) {
      clearInterval(bufferPollTimer)
      bufferPollTimer = null
    }
  }

  function startBufferPoll(): void {
    stopBufferPoll()
    bufferPollTimer = setInterval(() => { void onPollBuffer() }, BUFFER_POLL_MS)
  }

  function stopAutoSend(): void {
    if (autoSendTimer !== null) {
      clearInterval(autoSendTimer)
      autoSendTimer = null
    }
  }

  function restartAutoSend(): void {
    stopAutoSend()
    if (!serialConnected.value || !autoSendEnabled.value) return
    const ms = Math.max(50, autoSendIntervalMs.value)
    autoSendTimer = setInterval(() => { void onAutoSend() }, ms)
  }

  watch(serialConnected, (connected) => {
    if (connected) {
      startBufferPoll()
      restartAutoSend()
    } else {
      stopBufferPoll()
      stopAutoSend()
    }
  })

  watch(
    () => [autoSendEnabled.value, autoSendIntervalMs.value] as const,
    () => { restartAutoSend() }
  )

  function stopAll(): void {
    stopBufferPoll()
    stopAutoSend()
  }

  onUnmounted(stopAll)

  return { startBufferPoll, stopBufferPoll, restartAutoSend, stopAutoSend, stopAll }
}
