export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const MAX_DECIMALS = 4
export function roundMax(n: number, decimals = MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}
