/** 判断是否在浏览器环境（非 SSR）。 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
