import type { TenPlusTourStep } from '../types/tenPlusManual'

/** 点「？」后按顺序高亮的操作引导 */
export const TEN_PLUS_TOUR_STEPS: TenPlusTourStep[] = [
  {
    id: 'add-target',
    target: 'add-target',
    title: '新建编程目标',
    body: '一个目标对应一块石头。先新建或点选左侧目标，后面的工位绑定和任务表都作用在当前目标上。双击名称可重命名。',
    placement: 'right'
  },
  {
    id: 'add-row',
    target: 'add-row',
    title: '添加任务行',
    body: '给当前目标加一行切割参数。类型、尺寸、角度、高度、分割数、配方都在这张表里填。',
    placement: 'bottom'
  },
  {
    id: 'diamond-preset',
    target: 'diamond-preset',
    title: '钻石快捷形状',
    body: '圆钻输入直径；祖母绿 / 雷迪恩输入长宽。冠/腰/亭高比按侧视算出角度后写入当前目标。圆钻是四行等分线段；祖母绿 / 雷迪恩是四行切角矩形。',
    placement: 'bottom'
  },
  {
    id: 'shape-preset',
    target: 'shape-preset',
    title: '快捷形状编辑',
    body: '垫型、水滴、马眼按外接长宽生成轮廓行，写入当前目标。',
    placement: 'bottom'
  },
  {
    id: 'slots',
    target: 'slots',
    title: '十工位',
    body: '点格子选工位。未示教的先示教；已示教会绑定到当前目标，并带上点位 XYZ。开始任务必须已绑定工位。',
    placement: 'left'
  },
  {
    id: 'move-on-click',
    target: 'move-on-click',
    title: '点击移动',
    body: '如果勾选则会点击工位的时候就会移动，如果不勾选只会根据目标进行绑定工位。',
    placement: 'left',
    accent: 'red'
  },
  {
    id: 'teach',
    target: 'teach',
    title: '示教选中格',
    warning: '放置好石头之后一定要示教选中格！',
    body: '把当前机床坐标写入选中工位。不示教该格就不能绑定目标。点位 XYZ 请用「获取」，示教不会改它。',
    placement: 'left',
    accent: 'red',
    important: true
  },
  {
    id: 'point-xyz',
    target: 'point-xyz',
    title: '点位 XYZ',
    warning: '当角度选择 0 的时候，该 XYZ 就是切台面的位置。',
    body: '当前目标的切割参考点。绑定时自动带入，也可点「获取」读当前机床坐标。没有点位不能开始任务。',
    placement: 'left',
    accent: 'red',
    important: true
  },
  {
    id: 'opposite-cut',
    target: 'opposite-cut',
    title: '是否对切',
    body: '是否使用 R 轴旋转切。打开则采用 R 轴旋转；不打开就是一刀切。',
    placement: 'left'
  },
  {
    id: 'r-spin',
    target: 'r-spin',
    title: 'R 轴旋转',
    body: '先点选工位，再持续旋转观察石面，看完点暂停。加工前确认已停在安全姿态。',
    placement: 'left'
  },
  {
    id: 'ur-calib',
    target: 'ur-calib',
    title: 'UR 补偿校准',
    body: '选中工位后打开，用相机十字对中 U/R。对位不准时先做这一步。相机清晰误差按工位手填，开始任务时会带上。',
    placement: 'left'
  },
  {
    id: 'confirm',
    target: 'confirm',
    title: '已确认可正常加工',
    body: '安全确认。勾选后「开始任务」才会亮起。请先核对表内参数、工位绑定和点位。',
    placement: 'top'
  },
  {
    id: 'start',
    target: 'start',
    title: '开始任务',
    body: '弹出列表里勾选要加工的目标（须已绑定工位且有点位），再确认开始。',
    placement: 'top'
  },
  {
    id: 'files',
    target: 'files',
    title: '读取 / 保存',
    body: '保存当前全部编程目标到文件，或从文件读回，方便换班或换机台继续做。',
    placement: 'top'
  }
]
