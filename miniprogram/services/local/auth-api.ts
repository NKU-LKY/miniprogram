import type {
  ObserverRegisterParams,
  SafeUser,
  StaffLoginParams,
} from '../../types/user'
import { verifyPasswordLocal } from './crypto'
import {
  createObserverUser,
  findUserByOpenid,
  findUserByUsername,
  updateLastLogin,
} from './user-store'

export interface AuthResult {
  success: boolean
  user?: SafeUser
  message?: string
}

function toSafeUser(user: {
  user_id: string
  username?: string
  email?: string
  wechat_openid?: string
  role: SafeUser['role']
  status: SafeUser['status']
  nickname: string
  avatar_url: string
  created_at: string
  last_login_at: string
}): SafeUser {
  return {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    wechat_openid: user.wechat_openid,
    role: user.role,
    status: user.status,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  }
}

function checkActive(user: { status: string }): AuthResult | null {
  if (user.status === 'banned') {
    return { success: false, message: '账号已被封禁，无法登录' }
  }
  return null
}

/** 模拟微信 OpenID：开发阶段用本地持久化标识代替 */
export function getOrCreateMockOpenid(): Promise<string> {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => {
        const code = res.code || 'mock'
        const key = 'mock_openid'
        const stored = wx.getStorageSync(key) as string | undefined
        if (stored) {
          resolve(stored)
          return
        }
        const openid = `wx_mock_${code}_${Date.now()}`
        wx.setStorageSync(key, openid)
        resolve(openid)
      },
      fail: () => {
        const key = 'mock_openid'
        let openid = wx.getStorageSync(key) as string | undefined
        if (!openid) {
          openid = `wx_mock_fallback_${Date.now()}`
          wx.setStorageSync(key, openid)
        }
        resolve(openid)
      },
    })
  })
}

export async function registerObserver(
  params: ObserverRegisterParams
): Promise<AuthResult> {
  if (!params.nickname.trim()) {
    return { success: false, message: '请输入昵称' }
  }

  const openid = await getOrCreateMockOpenid()
  const existing = findUserByOpenid(openid)
  if (existing) {
    const banned = checkActive(existing)
    if (banned) return banned
    const updated = updateLastLogin(existing.user_id)
    return { success: true, user: toSafeUser(updated || existing) }
  }

  const user = createObserverUser({
    nickname: params.nickname.trim(),
    avatar_url: params.avatar_url,
    wechat_openid: openid,
  })

  return { success: true, user: toSafeUser(user) }
}

export async function loginObserver(): Promise<AuthResult> {
  const openid = await getOrCreateMockOpenid()
  const user = findUserByOpenid(openid)

  if (!user) {
    return { success: false, message: '尚未注册，请先完成注册' }
  }

  const banned = checkActive(user)
  if (banned) return banned

  const updated = updateLastLogin(user.user_id)
  return { success: true, user: toSafeUser(updated || user) }
}

export function loginStaff(params: StaffLoginParams): AuthResult {
  const { username, password, role } = params

  if (!username.trim() || !password) {
    return { success: false, message: '请输入账号和密码' }
  }

  const user = findUserByUsername(username.trim())
  if (!user) {
    return { success: false, message: '账号或密码错误' }
  }

  if (user.role !== role) {
    return { success: false, message: '账号或密码错误' }
  }

  if (!user.password_hash || !verifyPasswordLocal(password, user.password_hash)) {
    return { success: false, message: '账号或密码错误' }
  }

  const banned = checkActive(user)
  if (banned) return banned

  const updated = updateLastLogin(user.user_id)
  return { success: true, user: toSafeUser(updated || user) }
}
