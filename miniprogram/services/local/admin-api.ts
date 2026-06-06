import type { ObservationComment } from '../../types/comment'
import type { ObservationStatus } from '../../types/observation'
import { ROLE_LABELS, STATUS_LABELS, type AdminUserListItem, type UserRole } from '../../types/user'
import { formatRelativeTime } from '../../utils/time'
import { requireAdmin } from '../../utils/permissions'
import { findCommentById, getCommentsByObsId, softDeleteComment } from './comment-store'
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
}

export interface ModerationCommentItem {
  comment_id: string
  obs_id: string
  content: string
  author_nickname: string
  time_text: string
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
      }
    })
}

export function listCommentsForModeration(): ModerationCommentItem[] | { error: string } {
  const admin = requireAdmin()
  if (!admin) return { error: '无权限访问' }

  return getAllCommentsRaw()
    .filter((item) => item.status === 'active')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((comment) => {
      const author = findUserById(comment.user_id)
      return {
        comment_id: comment.comment_id,
        obs_id: comment.obs_id,
        content: comment.content,
        author_nickname: (author && author.nickname) || '未知用户',
        time_text: formatRelativeTime(comment.created_at),
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

  const updated = updateObservation(obsId, { status: 'approved' })
  if (!updated) return { success: false, message: '操作失败' }

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

  const obs = getAllObservations().find((item) => item.obs_id === comment.obs_id)
  if (obs) {
    const activeCount = getCommentsByObsId(comment.obs_id).length
    updateObservation(comment.obs_id, { comment_count: activeCount })
  }

  return { success: true }
}
