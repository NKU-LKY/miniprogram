import type { SafeUser, UserRole } from '../types/user'
import { getCurrentUser } from './session'

export function isAdmin(user?: SafeUser | null): boolean {
  return user ? user.role === 'admin' : false
}

export function canManageUsers(user?: SafeUser | null): boolean {
  return isAdmin(user)
}

export function canModerateContent(user?: SafeUser | null): boolean {
  return isAdmin(user)
}

export function isReviewer(user?: SafeUser | null): boolean {
  return user ? user.role === 'reviewer' : false
}

export function canIdentifySpecies(user?: SafeUser | null): boolean {
  return isReviewer(user)
}

/** 是否可发布观测记录（仅未封禁的观测者） */
export function canPublishObservation(user?: SafeUser | null): boolean {
  return Boolean(user && user.status === 'active' && user.role === 'observer')
}

export function requireAdmin(): SafeUser | null {
  const user = getCurrentUser()
  if (!user || !isAdmin(user)) return null
  return user
}

export function requireReviewer(): SafeUser | null {
  const user = getCurrentUser()
  if (!user || !canIdentifySpecies(user)) return null
  return user
}

export const ASSIGNABLE_ROLES: UserRole[] = ['observer', 'reviewer', 'admin']
