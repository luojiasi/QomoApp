
export const AUTH_STORAGE_KEY = 'qomotech-auth'
export type AccountInfo = {
  username: string
  password: string
}

export type AuthStorage = {
  username: string
  isAdmin: boolean
  isUser: boolean
  userAccount: AccountInfo
}

export type LoginResult = {
  success: boolean
  message: string
}


export const HOME_STATE_KEY = 'HOME_STATE'
export type HomeState = {
  ISARRIVEDHOME: boolean
  AUTO_HOME_ON_START: boolean
}
