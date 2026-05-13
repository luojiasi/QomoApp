// 这是给钻石的一个接口
interface RatioAndReal{
    Ratio:number  //比例
    Real:number  //实际大小
    Distance?:number  //角度
  }
export interface DiamondDetailParameters {
    id: string
    name: string
    type: string
    R:number
    P:number
    L:number
    W:number
    LW:number
    Depth:RatioAndReal
    Yield:number
    Pavilion:RatioAndReal
    Crown:RatioAndReal
    Girdle:RatioAndReal
    Table:RatioAndReal
    Tilt:number
    SW:number
  }
  