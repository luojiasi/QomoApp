/**
 * shared/api/wsClient.ts
 *
 * [已迁移] WebSocket 客户端从 core/ws/WsClient 重导出。
 * 兼容性：所有旧 import { WsClient } from '@/shared/api/wsClient' 仍然有效。
 */

export {
  WsClient,
  getBackendWsBaseUrl,
  getCameraStreamWsUrl,
  getProgramStatusWsUrl as getStartProgramStatusWsUrl,
  type WsClientOptions
} from '@/core/ws/WsClient'
