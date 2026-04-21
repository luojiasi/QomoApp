type StepType = 'notify' | 'delay' | 'condition' | 'loop' | 'function' 
// interface FuntcionConfig

interface Step{
    id:string
    title:string
    type:StepType
}