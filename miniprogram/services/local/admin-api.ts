import type { ModerationAppealItem } from '../../types/appeal'
import type { ObservationComment } from '../../types/comment'
import type { ObservationStatus } from '../../types/observation'
import { ROLE_LABELS, STATUS_LABELS, type AdminUserListItem, type UserRole } from '../../types/user'
import { formatRelativeTime } from '../../utils/time'
import { requireAdmin } from '../../utils/permissions'
import {
  findAppealById,
  findPendingAppealByObsId,
  listPendingAppeals,
  resolveAppeal,
} from './appeal-store'
import { findCommentById, getCommentsByObsId, restoreComment, softDeleteComment } from './comment-store'
import { isObservationFeatured, setObservationFeatured } from './featured-store'
import {
  notifyAppealApproved,
  notifyAppealRejected,
  notifyObservationHidden,
} from './notification-api'
import { getAllObservations, updateObservation } from './observation-store'
import { getLocalItem } from './storage'
import { findUserById, getAllUsers, updateUserRole, updateUserStatus } from './user-store'

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

const OBS_STATUS_LABELS: Partial<Record<ObservationStatus, string>> = {
  approved: '已发布',
  needs_identification: '待鉴定',
  identified: '已鉴定',
  rejected: '已隐藏',
  pending_review: '待审核',
  withdrawn: '已撤回',
}

export interface ModerationObsItem {
  obs_id: string
  photo_url: string
  note: string
  publisher_nickname: string
  status: ObservationStatus
  status_label: string
  time_text: string
  is_hidden: boolean
  is_featured: boolean
  has_pending_appeal: boolean
}

export interface ModerationCommentItem {
  comment_id: string
  obs_id: string
  content: string
  author_nickname: string
  time_text: string
  is_hidden: boolean
  status_label?: string
}

export interface AdminActionResult {
  success: boolean
  message?: string
}

function getAllCommentsRaw(): ObservationComment[] {
  const stored = getLocalItem<ObservationComment[]>('observation_comments')
  return Array.isArray(stored) ? stored : []
}

function toAdminUserItem(user: ReturnType<typeof getAllUsers>[number], selfId: string): AdminUserListItem {
  return {
    user_id: user.user_id,
    nickname: user.nickname,
    avatar_url: user.avatar_url || DEFAULT_AVATAR,
    username: user.username,
    role: user.role,
    role_label: ROLE_LABELS[user.role],
    status: user.status,
    status_label: STATUS_LABELS[user.status],
    last_login_text: formatRelativeTime(user.last_login_at),
    is_self: user.user_id === selfId,
  }
}

export function listUsersForAdmin(): AdminUserListItem[] | { error: string } {
  const admin = requireAdmin()
  if (!admin) return { error: '无权限访问' }

  return getAllUsers()
    .slice()
    .sort((a, b) => new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime())
    .map((user) => toAdminUserItem(user, admin.user_id))
}

export function setUserRoleForAdmin(targetUserId: string, role: UserRole): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }
  if (admin.user_id === targetUserId) {
    return { success: false, message: '不能修改自己的角色' }
  }

  const target = findUserById(targetUserId)
  if (!target) return { success: false, message: '用户不存在' }

  const updated = updateUserRole(targetUserId, role)
  if (!updated) return { success: false, message: '更新失败' }

  return { success: true }
}

export function setUserBanForAdmin(targetUserId: string, banned: boolean): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }
  if (admin.user_id === targetUserId) {
    return { success: false, message: '不能封禁自己' }
  }

  const target = findUserById(targetUserId)
  if (!target) return { success: false, message: '用户不存在' }

  const updated = updateUserStatus(targetUserId, banned ? 'banned' : 'active')
  if (!updated) return { success: false, message: '更新失败' }

  return { success: true }
}

export function listObservationsForModeration(): ModerationObsItem[] | { error: string } {
  const admin = requireAdmin()
  if (!admin) return { error: '无权限访问' }

  return getAllObservations()
    .slice()
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((obs) => {
      const publisher = findUserById(obs.user_id)
      return {
        obs_id: obs.obs_id,
        photo_url: obs.photo_url,
        note: obs.note || '（无描述）',
        publisher_nickname: (publisher && publisher.nickname) || '未知用户',
        status: obs.status,
        status_label: OBS_STATUS_LABELS[obs.status] || obs.status,
        time_text: formatRelativeTime(obs.submitted_at),
        is_hidden: obs.status === 'rejected' || obs.status === 'pending_review',
        is_featured: isObservationFeatured(obs.obs_id),
        has_pending_appeal: Boolean(findPendingAppealByObsId(obs.obs_id)),
      }
    })
}

export function listCommentsForModeration(): ModerationCommentItem[] | { error: string } {
  const admin = requireAdmin()
  if (!admin) return { error: '无权限访问' }

  return getAllCommentsRaw()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((comment) => {
      const author = findUserById(comment.user_id)
      const isHidden = comment.status === 'deleted'
      return {
        comment_id: comment.comment_id,
        obs_id: comment.obs_id,
        content: comment.content,
        author_nickname: (author && author.nickname) || '未知用户',
        time_text: formatRelativeTime(comment.created_at),
        is_hidden: isHidden,
        status_label: isHidden ? '已隐藏' : undefined,
      }
    })
}

export function hideObservationForAdmin(obsId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const obs = getAllObservations().find((item) => item.obs_id === obsId)
  if (!obs) return { success: false, message: '记录不存在' }
  if (obs.status === 'rejected') return { success: false, message: '该记录已隐藏' }

  const updated = updateObservation(obsId, { status: 'rejected' })
  if (!updated) return { success: false, message: '操作失败' }

  notifyObservationHidden({
    ownerUserId: obs.user_id,
    adminUserId: admin.user_id,
    obsId: obs.obs_id,
  })

  return { success: true }
}

export function restoreObservationForAdmin(obsId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const obs = getAllObservations().find((item) => item.obs_id === obsId)
  if (!obs) return { success: false, message: '记录不存在' }
  if (obs.status !== 'rejected' && obs.status !== 'pending_review') {
    return { success: false, message: '该记录无需恢复' }
  }

  const pendingAppeal = findPendingAppealByObsId(obsId)
  if (pendingAppeal) {
    return approveAppealForAdmin(pendingAppeal.appeal_id)
  }

  const updated = updateObservation(obsId, { status: 'approved' })
  if (!updated) return { success: false, message: '操作失败' }

  return { success: true }
}

export function listAppealsForModeration(): ModerationAppealItem[] | { error: string } {
  const admin = requireAdmin()
  if (!admin) return { error: '无权限访问' }

  const observations = getAllObservations()

  return listPendingAppeals().map((appeal) => {
    const obs = observations.find((item) => item.obs_id === appeal.obs_id)
    const appellant = findUserById(appeal.user_id)
    return {
      appeal_id: appeal.appeal_id,
      obs_id: appeal.obs_id,
      appellant_user_id: appeal.user_id,
      photo_url: (obs && obs.photo_url) || '',
      obs_note: (obs && (obs.note || '（无描述）')) || '（记录已不存在）',
      reason: appeal.reason,
      appellant_nickname: (appellant && appellant.nickname) || '未知用户',
      time_text: formatRelativeTime(appeal.created_at),
    }
  })
}

export function approveAppealForAdmin(appealId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const appeal = findAppealById(appealId)
  if (!appeal) return { success: false, message: '申诉不存在' }
  if (appeal.status !== 'pending') return { success: false, message: '该申诉已处理' }

  const obs = getAllObservations().find((item) => item.obs_id === appeal.obs_id)
  if (!obs) return { success: false, message: '关联记录不存在' }

  const updated = updateObservation(appeal.obs_id, { status: 'approved' })
  if (!updated) return { success: false, message: '恢复记录失败' }

  resolveAppeal(appealId, 'approved', admin.user_id)

  notifyAppealApproved({
    ownerUserId: appeal.user_id,
    adminUserId: admin.user_id,
    obsId: appeal.obs_id,
  })

  return { success: true }
}

export function rejectAppealForAdmin(appealId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const appeal = findAppealById(appealId)
  if (!appeal) return { success: false, message: '申诉不存在' }
  if (appeal.status !== 'pending') return { success: false, message: '该申诉已处理' }

  const resolved = resolveAppeal(appealId, 'rejected', admin.user_id)
  if (!resolved) return { success: false, message: '操作失败' }

  notifyAppealRejected({
    ownerUserId: appeal.user_id,
    adminUserId: admin.user_id,
    obsId: appeal.obs_id,
  })

  return { success: true }
}

export function hideCommentForAdmin(commentId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const comment = findCommentById(commentId)
  if (!comment) return { success: false, message: '评论不存在' }
  if (comment.status === 'deleted') return { success: false, message: '该评论已隐藏' }

  const deleted = softDeleteComment(commentId)
  if (!deleted) return { success: false, message: '操作失败' }

  return { success: true }
}

export function restoreCommentForAdmin(commentId: string): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const comment = findCommentById(commentId)
  if (!comment) return { success: false, message: '评论不存在' }
  if (comment.status !== 'deleted') return { success: false, message: '该评论无需恢复' }

  const restored = restoreComment(commentId)
  if (!restored) return { success: false, message: '操作失败' }

  return { success: true }
}

export function setObservationFeaturedForAdmin(obsId: string, featured: boolean): AdminActionResult {
  const admin = requireAdmin()
  if (!admin) return { success: false, message: '无权限操作' }

  const trimmedId = obsId.trim()
  const obs = getAllObservations().find((item) => item.obs_id === trimmedId)
  if (!obs) return { success: false, message: '记录不存在' }
  if (obs.status === 'rejected' || obs.status === 'pending_review') {
    return { success: false, message: '已隐藏的记录不能设为精选' }
  }
  if (isObservationFeatured(trimmedId) === featured) {
    return { success: true }
  }

  const saved = setObservationFeatured(trimmedId, featured)
  if (!saved) {
    return { success: false, message: featured ? '设为精选失败' : '取消精选失败' }
  }

  return { success: true }
}
