import type {
  ObserverRegisterParams,
  SafeUser,
  StaffLoginParams,
} from '../../types/user'
import {
  loginObserver as localLoginObserver,
  loginStaff as localLoginStaff,
  registerObserver as localRegisterObserver,
} from '../local/auth-api'
import { USE_LOCAL_BACKEND } from './config'

export interface AuthResult {
  success: boolean
  user?: SafeUser
  message?: string
}

export function registerObserver(params: ObserverRegisterParams): Promise<AuthResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程注册 API 待实现'))
  }
  return localRegisterObserver(params)
}

export function loginObserver(): Promise<AuthResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程登录 API 待实现'))
  }
  return localLoginObserver()
}

export function loginStaff(params: StaffLoginParams): AuthResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程职员登录 API 待实现')
  }
  return localLoginStaff(params)
}
