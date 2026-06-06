import type { AdminUserListItem, UserRole } from '../../types/user'
import {
  hideCommentForAdmin as localHideComment,
  hideObservationForAdmin as localHideObservation,
  listCommentsForModeration as localListComments,
  listObservationsForModeration as localListObservations,
  listUsersForAdmin as localListUsers,
  restoreObservationForAdmin as localRestoreObservation,
  setUserBanForAdmin as localSetUserBan,
  setUserRoleForAdmin as localSetUserRole,
  type AdminActionResult,
  type ModerationCommentItem,
  type ModerationObsItem,
} from '../local/admin-api'
import { USE_LOCAL_BACKEND } from './config'

export type { AdminActionResult, ModerationCommentItem, ModerationObsItem }

export function listUsersForAdmin(): AdminUserListItem[] | { error: string } {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localListUsers()
}

export function setUserRoleForAdmin(targetUserId: string, role: UserRole): AdminActionResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localSetUserRole(targetUserId, role)
}

export function setUserBanForAdmin(targetUserId: string, banned: boolean): AdminActionResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localSetUserBan(targetUserId, banned)
}

export function listObservationsForModeration(): ModerationObsItem[] | { error: string } {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localListObservations()
}

export function listCommentsForModeration(): ModerationCommentItem[] | { error: string } {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localListComments()
}

export function hideObservationForAdmin(obsId: string): AdminActionResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localHideObservation(obsId)
}

export function restoreObservationForAdmin(obsId: string): AdminActionResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localRestoreObservation(obsId)
}

export function hideCommentForAdmin(commentId: string): AdminActionResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程管理员 API 待实现')
  }
  return localHideComment(commentId)
}
