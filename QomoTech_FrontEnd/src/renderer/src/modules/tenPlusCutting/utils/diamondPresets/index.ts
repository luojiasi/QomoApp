import type { 钻石预设输入, 钻石预设行草稿 } from '../../types/diamondPreset'
import { 钻石预设错误 } from './共用'
import { 生成公主方行 } from './B公主方'
import { 生成圆钻行 } from './A圆钻'
import { 生成祖母绿行 } from './D祖母绿'
import { 生成雷迪恩行 } from './C雷迪恩'

export {
  层高毫米,
  切工标签,
  切工轮廓,
  切工需要长宽,
  创建默认钻石预设,
  生成钻石侧视,
  钻石预设错误
} from './共用'

/**
 * 四行：台面 → 冠 → 腰 → 亭。
 * 台面一律等分线段；冠/腰/亭路径由切工文件决定。
 */
export function 生成钻石预设行(输入: 钻石预设输入): 钻石预设行草稿[] {
  const 错误 = 钻石预设错误(输入)
  if (错误) throw new Error(错误)
  switch (输入.切工) {
    case '圆钻':
      return 生成圆钻行(输入)
    case '公主方':
      return 生成公主方行(输入)
    case '祖母绿':
      return 生成祖母绿行(输入)
    case '雷迪恩':
      return 生成雷迪恩行(输入)
    default: {
      const _never: never = 输入.切工
      throw new Error(`未实现的钻石切工：${String(_never)}`)
    }
  }
}
