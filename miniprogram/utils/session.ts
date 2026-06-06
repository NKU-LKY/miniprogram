import type { SafeUser } from '../types/user'

const SESSION_KEY = 'current_session'

export interface Session {
  user: SafeUser
  login_at: string
}

export function getSession(): Session | null {
  try {
    const raw = wx.getStorageSync(SESSION_KEY)
    return raw ? (raw as Session) : null
  } catch (err) {
    return null
  }
}

export function setSession(user: SafeUser): void {
  const session: Session = {
    user,
    login_at: new Date().toISOString(),
  }
  wx.setStorageSync(SESSION_KEY, session)
}

export function clearSession(): void {
  wx.removeStorageSync(SESSION_KEY)
}

export function isLoggedIn(): boolean {
  return getSession() !== null
}

export function getCurrentUser(): SafeUser | null {
  const session = getSession()
  return session ? session.user : null
}
