// 这是给钻石的一个接口
interface RatioAndReal{
    Ratio:number
    Real:number
  }
export interface DiamondDetailParameters {
    id: string
    name: string
    R:number
    P:number
    L:number
    W:number
    LW:number
    Depth:RatioAndReal
    Yield:RatioAndReal
    Pavilion:RatioAndReal
    Crown:RatioAndReal
    Girdle:RatioAndReal
    Table:RatioAndReal
    Tilt:number
    SW:number
  }
  