import type {
  ObserverRegisterParams,
  SafeUser,
  StaffLoginParams,
} from '../../../types/user'
import type { AuthResult } from '../auth'
import { uploadFile, request } from './client'
import { mapRemoteUser } from './mappers'
import type { RemoteUser } from './types'

function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code)
          return
        }
        reject(new Error('获取微信登录凭证失败'))
      },
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })
}

function clearLegacyMockStorage(): void {
  wx.removeStorageSync('mock_openid')
  wx.removeStorageSync('wechat_openid')
}

function toAuthResult(user: RemoteUser): AuthResult {
  return { success: true, user: mapRemoteUser(user) }
}

export async function registerObserverRemote(params: ObserverRegisterParams): Promise<AuthResult> {
  if (!params.nickname.trim()) {
    return { success: false, message: '请输入昵称' }
  }

  clearLegacyMockStorage()

  let code: string
  try {
    code = await wxLoginCode()
  } catch (err) {
    const message = err instanceof Error ? err.message : '微信登录失败'
    return { success: false, message }
  }

  try {
    const user = await uploadFile<RemoteUser>('/api/users/wechat', params.avatar_url, 'avatar', {
      code,
      nickname: params.nickname.trim(),
    })
    return toAuthResult(user)
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败'
    if (message.includes('已存在')) {
      return loginObserverRemote()
    }
    return { success: false, message }
  }
}

export async function loginObserverRemote(): Promise<AuthResult> {
  clearLegacyMockStorage()

  let code: string
  try {
    code = await wxLoginCode()
  } catch (err) {
    const message = err instanceof Error ? err.message : '微信登录失败'
    return { success: false, message }
  }

  try {
    const user = await request<RemoteUser>('/api/users/wechat/login', {
      method: 'POST',
      data: { code },
    })
    return toAuthResult(user)
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败'
    return { success: false, message }
  }
}

export async function loginStaffRemote(params: StaffLoginParams): Promise<AuthResult> {
  const { username, password, role } = params

  if (!username.trim() || !password) {
    return { success: false, message: '请输入账号和密码' }
  }

  try {
    const user = await request<RemoteUser>('/api/users/admin/login', {
      method: 'POST',
      data: { username: username.trim(), password },
    })

    if (user.role !== role) {
      return { success: false, message: '账号或密码错误' }
    }

    return toAuthResult(user)
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败'
    return { success: false, message: message.includes('封禁') ? '账号已被封禁，无法登录' : '账号或密码错误' }
  }
}

export async function fetchUserByCode(): Promise<SafeUser | null> {
  try {
    const code = await wxLoginCode()
    const user = await request<RemoteUser>('/api/users/code', {
      method: 'POST',
      data: { code },
    })
    return mapRemoteUser(user)
  } catch {
    return null
  }
}

export async function fetchUserById(userId: string): Promise<SafeUser | null> {
  try {
    const user = await request<RemoteUser>(`/api/users/${userId}`)
    return mapRemoteUser(user)
  } catch {
    return null
  }
}
