import type {
  ObserverRegisterParams,
  SafeUser,
  StaffLoginParams,
} from '../../types/user'
import {
  loginObserver as localLoginObserver,
  loginStaff as localLoginStaff,
  registerObserver as localRegisterObserver,
  getOrCreateMockOpenid as localGetOrCreateMockOpenid,
} from '../local/auth-api'
import { findUserById as localFindUserById } from '../local/user-store'
import { USE_LOCAL_BACKEND } from './config'
import {
  fetchUserByCode,
  fetchUserById,
  loginObserverRemote,
  loginStaffRemote,
  registerObserverRemote,
} from './remote/auth'

export interface AuthResult {
  success: boolean
  user?: SafeUser
  message?: string
}

/** 本地模式专用；远程模式由后端通过 code 识别同一微信号 */
export function getWechatOpenid(): Promise<string> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程模式无需单独获取 openid'))
  }
  return localGetOrCreateMockOpenid()
}

/** @deprecated 请使用 getWechatOpenid */
export const getOrCreateMockOpenid = getWechatOpenid

export function registerObserver(params: ObserverRegisterParams): Promise<AuthResult> {
  if (!USE_LOCAL_BACKEND) {
    return registerObserverRemote(params)
  }
  return localRegisterObserver(params)
}

export function loginObserver(): Promise<AuthResult> {
  if (!USE_LOCAL_BACKEND) {
    return loginObserverRemote()
  }
  return localLoginObserver()
}

export function loginStaff(params: StaffLoginParams): Promise<AuthResult> {
  if (!USE_LOCAL_BACKEND) {
    return loginStaffRemote(params)
  }
  return Promise.resolve(localLoginStaff(params))
}

export function findUserById(userId: string): Promise<SafeUser | null> {
  if (!USE_LOCAL_BACKEND) {
    return fetchUserById(userId)
  }
  return Promise.resolve(localFindUserById(userId) || null)
}

export function findCurrentWechatUser(): Promise<SafeUser | null> {
  if (!USE_LOCAL_BACKEND) {
    return fetchUserByCode()
  }
  return localLoginObserver().then((result) => (result.success ? result.user || null : null))
}
