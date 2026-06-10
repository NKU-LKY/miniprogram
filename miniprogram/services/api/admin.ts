import type { ModerationAppealItem } from '../../types/appeal'
import type { AdminUserListItem, UserRole } from '../../types/user'
import { requireAdmin } from '../../utils/permissions'
import {
  approveAppealForAdmin as localApproveAppeal,
  hideCommentForAdmin as localHideComment,
  hideObservationForAdmin as localHideObservation,
  listAppealsForModeration as localListAppeals,
  listCommentsForModeration as localListComments,
  listObservationsForModeration as localListObservations,
  listUsersForAdmin as localListUsers,
  rejectAppealForAdmin as localRejectAppeal,
  restoreObservationForAdmin as localRestoreObservation,
  setObservationFeaturedForAdmin as localSetObservationFeatured,
  setUserBanForAdmin as localSetUserBan,
  setUserRoleForAdmin as localSetUserRole,
  type AdminActionResult,
  type ModerationCommentItem,
  type ModerationObsItem,
} from '../local/admin-api'
import { USE_LOCAL_BACKEND } from './config'
import {
  approveAppealRemote,
  hideCommentForAdminRemote,
  hideObservationForAdminRemote,
  listAppealsForModerationRemote,
  listCommentsForModerationRemote,
  listObservationsForModerationRemote,
  listUsersForAdminRemote,
  rejectAppealRemote,
  restoreObservationForAdminRemote,
  setObservationFeaturedForAdminRemote,
  setUserBanForAdminRemote,
  setUserRoleForAdminRemote,
} from './remote/admin'

export type { AdminActionResult, ModerationAppealItem, ModerationCommentItem, ModerationObsItem }

export function listUsersForAdmin(): Promise<AdminUserListItem[] | { error: string }> {
  const admin = requireAdmin()
  if (!admin) return Promise.resolve({ error: '无权限访问' })

  if (!USE_LOCAL_BACKEND) {
    return listUsersForAdminRemote(admin.user_id).catch(() => ({ error: '加载失败' }))
  }
  return Promise.resolve(localListUsers())
}

export function setUserRoleForAdmin(targetUserId: string, role: UserRole): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return setUserRoleForAdminRemote(targetUserId, role)
  }
  return Promise.resolve(localSetUserRole(targetUserId, role))
}

export function setUserBanForAdmin(targetUserId: string, banned: boolean): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return setUserBanForAdminRemote(targetUserId, banned)
  }
  return Promise.resolve(localSetUserBan(targetUserId, banned))
}

export function listObservationsForModeration(): Promise<ModerationObsItem[] | { error: string }> {
  if (!USE_LOCAL_BACKEND) {
    return listObservationsForModerationRemote().catch(() => ({ error: '加载失败' }))
  }
  return Promise.resolve(localListObservations())
}

export function listCommentsForModeration(): Promise<ModerationCommentItem[] | { error: string }> {
  if (!USE_LOCAL_BACKEND) {
    return listCommentsForModerationRemote().catch(() => ({ error: '加载失败' }))
  }
  return Promise.resolve(localListComments())
}

export function hideObservationForAdmin(obsId: string): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return hideObservationForAdminRemote(obsId)
  }
  return Promise.resolve(localHideObservation(obsId))
}

export function restoreObservationForAdmin(obsId: string): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return restoreObservationForAdminRemote(obsId)
  }
  return Promise.resolve(localRestoreObservation(obsId))
}

export function setObservationFeaturedForAdmin(
  obsId: string,
  featured: boolean,
): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return setObservationFeaturedForAdminRemote(obsId, featured)
  }
  return Promise.resolve(localSetObservationFeatured(obsId, featured))
}

export function hideCommentForAdmin(commentId: string): Promise<AdminActionResult> {
  if (!USE_LOCAL_BACKEND) {
    return hideCommentForAdminRemote(commentId)
  }
  return Promise.resolve(localHideComment(commentId))
}

export function listAppealsForModeration(): Promise<ModerationAppealItem[] | { error: string }> {
  if (!USE_LOCAL_BACKEND) {
    return listAppealsForModerationRemote().catch(() => ({ error: '加载失败' }))
  }
  return Promise.resolve(localListAppeals())
}

export function approveAppealForAdmin(appealId: string): Promise<AdminActionResult> {
  const admin = requireAdmin()
  if (!admin) return Promise.resolve({ success: false, message: '无权限操作' })

  if (!USE_LOCAL_BACKEND) {
    return approveAppealRemote(appealId, admin.user_id)
  }
  return Promise.resolve(localApproveAppeal(appealId))
}

export function rejectAppealForAdmin(appealId: string): Promise<AdminActionResult> {
  const admin = requireAdmin()
  if (!admin) return Promise.resolve({ success: false, message: '无权限操作' })

  if (!USE_LOCAL_BACKEND) {
    return rejectAppealRemote(appealId, admin.user_id)
  }
  return Promise.resolve(localRejectAppeal(appealId))
}
