export interface BackendBootstrapResult {
  success: boolean
  message: string
  data?: { hardware?: any; motion?: any; params?: any }
}
