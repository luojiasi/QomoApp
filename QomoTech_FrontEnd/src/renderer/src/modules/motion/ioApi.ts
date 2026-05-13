import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'

// ------------------------------------------------------------------
// IO 输出
// ------------------------------------------------------------------

export interface MotionIoOutputState { io_no: number; value: boolean }

export const setMotionIoOutput = async (ioNo: number, value: boolean): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/io/output', 'POST', { io: ioNo, value } as unknown as Record<string, unknown>)

export const getMotionIoOutput = async (ioNo: number): Promise<ApiCallResult<MotionIoOutputState>> => {
  const res = await apiCall<boolean>(`motion/io/output/${Number(ioNo)}`, 'GET')
  // 新后端 data 为原始 bool，包装为老格式保持兼容
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : res as unknown as ApiCallResult<MotionIoOutputState>
}

export const getMotionIoOutputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/output', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })

// ------------------------------------------------------------------
// IO 输入
// ------------------------------------------------------------------

export interface MotionIoInputState { io_no: number; value: boolean }

export const getMotionIoInput = async (ioNo: number): Promise<ApiCallResult<MotionIoInputState>> => {
  const res = await apiCall<boolean>(`motion/io/input/${Number(ioNo)}`, 'GET')
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : res as unknown as ApiCallResult<MotionIoInputState>
}

export const getMotionIoInputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/input', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })
