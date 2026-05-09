import { apiCall, type ApiCallResult } from '../core/base'

// ------------------------------------------------------------------
// IO 输出
// ------------------------------------------------------------------

export interface MotionIoOutputState { io_no: number; value: boolean }

export const setMotionIoOutput = async (ioNo: number, value: boolean): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/io/output', 'POST', { io_no: ioNo, value } as unknown as Record<string, unknown>)

export const getMotionIoOutput = async (ioNo: number): Promise<ApiCallResult<MotionIoOutputState>> =>
  apiCall<MotionIoOutputState>(`motion/io/output/${Number(ioNo)}`, 'GET')

export const getMotionIoOutputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/outputs', 'GET', null, {
    io_start: Number(ioStart),
    io_end: Number(ioEnd)
  })

// ------------------------------------------------------------------
// IO 输入
// ------------------------------------------------------------------

export interface MotionIoInputState { io_no: number; value: boolean }

export const getMotionIoInput = async (ioNo: number): Promise<ApiCallResult<MotionIoInputState>> =>
  apiCall<MotionIoInputState>(`motion/io/input/${Number(ioNo)}`, 'GET')

export const getMotionIoInputsStatus = async (ioStart = 0, ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/inputs', 'GET', null, {
    io_start: Number(ioStart),
    io_end: Number(ioEnd)
  })
