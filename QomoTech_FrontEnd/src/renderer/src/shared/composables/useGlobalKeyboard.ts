export type GlobalKeyboardHandler = (event: KeyboardEvent) => void

const handlers = new Set<GlobalKeyboardHandler>()

export const subscribeGlobalKeyboard = (handler: GlobalKeyboardHandler): (() => void) => {
  handlers.add(handler)
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
