import type { SafeUser, UserRole } from '../types/user'
import { getCurrentUser } from './session'

export function isAdmin(user?: SafeUser | null): boolean {
  return user?.role === 'admin'
}

export function canManageUsers(user?: SafeUser | null): boolean {
  return isAdmin(user)
}

export function canModerateContent(user?: SafeUser | null): boolean {
  return isAdmin(user)
}

export function requireAdmin(): SafeUser | null {
  const user = getCurrentUser()
  if (!user || !isAdmin(user)) return null
  return user
}

export const ASSIGNABLE_ROLES: UserRole[] = ['observer', 'reviewer', 'admin']
