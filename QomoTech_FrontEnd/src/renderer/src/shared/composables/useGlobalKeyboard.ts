export type GlobalKeyboardHandler = (event: KeyboardEvent) => void

const handlers = new Set<GlobalKeyboardHandler>()
/** 告警阈值：超过此数量说明存在未清理的 handler 泄露 */
const HANDLER_COUNT_WARN_THRESHOLD = 20

export const subscribeGlobalKeyboard = (handler: GlobalKeyboardHandler): (() => void) => {
  handlers.add(handler)
  if (handlers.size >= HANDLER_COUNT_WARN_THRESHOLD) {
    console.warn(
      `[useGlobalKeyboard] handler 数量已达 ${handlers.size}，超过阈值 ${HANDLER_COUNT_WARN_THRESHOLD}，可能存在未清理的订阅`
    )
  }
  return () => {
    handlers.delete(handler)
  }
}

export const dispatchGlobalKeyboard = (event: KeyboardEvent): void => {
  for (const h of handlers) {
    try {
      h(event)
    } catch (err) {
      console.error('[useGlobalKeyboard] handler 异常:', err)
    }
  }
}
