import { SEED_USERS } from '../../data/users.seed'
import type { User } from '../../types/user'
import { getLocalItem, setLocalItem } from './storage'

const USERS_KEY = 'users'
const SEED_VERSION_KEY = 'users_seed_version'
const CURRENT_SEED_VERSION = 2

function generateId(): string {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function now(): string {
  return new Date().toISOString()
}

function syncSeedUsers(): User[] {
  const version = getLocalItem<number>(SEED_VERSION_KEY)
  let users = getLocalItem<User[]>(USERS_KEY) || []

  if (version !== CURRENT_SEED_VERSION) {
    users = SEED_USERS.map((seed, index) => ({
      ...seed,
      user_id: `seed_${index + 1}`,
      created_at: now(),
      last_login_at: now(),
    }))
    setLocalItem(USERS_KEY, users)
    setLocalItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
    return users
  }

  SEED_USERS.forEach((seed, index) => {
    const expectedId = `seed_${index + 1}`
    if (!users.find((u) => u.user_id === expectedId)) {
      users.push({
        ...seed,
        user_id: expectedId,
        created_at: now(),
        last_login_at: now(),
      })
    }
  })

  setLocalItem(USERS_KEY, users)
  return users
}

export function getAllUsers(): User[] {
  return syncSeedUsers()
}

export function saveUsers(users: User[]): void {
  setLocalItem(USERS_KEY, users)
}

export function findUserById(userId: string): User | undefined {
  return getAllUsers().find((u) => u.user_id === userId)
}

export function findUserByUsername(username: string): User | undefined {
  return getAllUsers().find((u) => u.username === username)
}

export function findUserByOpenid(openid: string): User | undefined {
  return getAllUsers().find((u) => u.wechat_openid === openid)
}

export function createObserverUser(params: {
  nickname: string
  avatar_url: string
  wechat_openid: string
}): User {
  const users = getAllUsers()
  const existing = users.find((u) => u.wechat_openid === params.wechat_openid)
  if (existing) {
    return existing
  }

  const user: User = {
    user_id: generateId(),
    wechat_openid: params.wechat_openid,
    role: 'observer',
    status: 'active',
    nickname: params.nickname,
    avatar_url: params.avatar_url,
    created_at: now(),
    last_login_at: now(),
  }

  users.push(user)
  saveUsers(users)
  return user
}

export function updateLastLogin(userId: string): User | undefined {
  const users = getAllUsers()
  const index = users.findIndex((u) => u.user_id === userId)
  if (index < 0) return undefined

  users[index] = { ...users[index], last_login_at: now() }
  saveUsers(users)
  return users[index]
}
