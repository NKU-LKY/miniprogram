import type { NotificationItem, NotificationType } from '../../types/notification'
import { formatRelativeTime } from '../../utils/time'
import {
  clearAllNotifications as clearAllNotificationsInStore,
  countUnreadNotifications,
  createNotification,
  listNotificationsByUserId,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-store'
import { getAllUsers } from './user-store'

const TYPE_META: Record<NotificationType, { label: string; icon: string }> = {
  identification_result: { label: '鉴定结果', icon: '🔬' },
  comment: { label: '新评论', icon: '💬' },
  comment_reply: { label: '评论回复', icon: '↩️' },
  observation_hidden: { label: '记录隐藏', icon: '🚫' },
  appeal_received: { label: '隐藏申诉', icon: '📋' },
  appeal_approved: { label: '申诉通过', icon: '✅' },
  appeal_rejected: { label: '申诉驳回', icon: '❌' },
}

function toNotificationItem(notification: ReturnType<typeof listNotificationsByUserId>[number]): NotificationItem {
  const meta = TYPE_META[notification.type]
  return {
    notification_id: notification.notification_id,
    type: notification.type,
    type_label: meta.label,
    type_icon: meta.icon,
    title: notification.title,
    content: notification.content,
    obs_id: notification.obs_id,
    comment_id: notification.comment_id,
    is_read: notification.is_read,
    time_text: formatRelativeTime(notification.created_at),
  }
}

export function listUserNotifications(userId: string): NotificationItem[] {
  return listNotificationsByUserId(userId).map(toNotificationItem)
}

export function getUnreadNotificationCount(userId: string): number {
  return countUnreadNotifications(userId)
}

export function readNotification(notificationId: string, userId: string): NotificationItem | null {
  const updated = markNotificationRead(notificationId, userId)
  return updated ? toNotificationItem(updated) : null
}

export function readAllNotifications(userId: string): number {
  return markAllNotificationsRead(userId)
}

export function clearAllNotifications(userId: string): number {
  return clearAllNotificationsInStore(userId)
}

export function notifyIdentificationResult(params: {
  ownerUserId: string
  reviewerUserId: string
  obsId: string
  speciesName: string
  reviewNote?: string
}): void {
  if (params.ownerUserId === params.reviewerUserId) return

  const noteSuffix = params.reviewNote ? `，备注：${params.reviewNote}` : ''
  createNotification({
    user_id: params.ownerUserId,
    type: 'identification_result',
    title: '鉴定完成',
    content: `你提交的观测记录已被鉴定为「${params.speciesName}」${noteSuffix}`,
    obs_id: params.obsId,
    actor_user_id: params.reviewerUserId,
  })
}

export function notifyObservationComment(params: {
  ownerUserId: string
  commenterUserId: string
  obsId: string
  commentId: string
  commentPreview: string
}): void {
  if (params.ownerUserId === params.commenterUserId) return

  const preview =
    params.commentPreview.length > 40
      ? `${params.commentPreview.slice(0, 40)}…`
      : params.commentPreview

  createNotification({
    user_id: params.ownerUserId,
    type: 'comment',
    title: '收到新评论',
    content: preview,
    obs_id: params.obsId,
    comment_id: params.commentId,
    actor_user_id: params.commenterUserId,
  })
}

export function notifyCommentReply(params: {
  replyToUserId: string
  commenterUserId: string
  obsId: string
  commentId: string
  commentPreview: string
}): void {
  if (params.replyToUserId === params.commenterUserId) return

  const preview =
    params.commentPreview.length > 40
      ? `${params.commentPreview.slice(0, 40)}…`
      : params.commentPreview

  createNotification({
    user_id: params.replyToUserId,
    type: 'comment_reply',
    title: '收到评论回复',
    content: preview,
    obs_id: params.obsId,
    comment_id: params.commentId,
    actor_user_id: params.commenterUserId,
  })
}

export function notifyObservationHidden(params: {
  ownerUserId: string
  adminUserId: string
  obsId: string
}): void {
  if (params.ownerUserId === params.adminUserId) return

  createNotification({
    user_id: params.ownerUserId,
    type: 'observation_hidden',
    title: '记录已被隐藏',
    content: '你发布的观测记录已被管理员隐藏，如有异议可在详情页提交申诉',
    obs_id: params.obsId,
    actor_user_id: params.adminUserId,
  })
}

export function notifyAdminsAppealReceived(params: {
  appellantUserId: string
  obsId: string
  appealId: string
  reason: string
}): void {
  const admins = getAllUsers().filter((user) => user.role === 'admin' && user.status === 'active')
  const preview =
    params.reason.length > 40 ? `${params.reason.slice(0, 40)}…` : params.reason

  admins.forEach((admin) => {
    if (admin.user_id === params.appellantUserId) return
    createNotification({
      user_id: admin.user_id,
      type: 'appeal_received',
      title: '收到隐藏申诉',
      content: preview,
      obs_id: params.obsId,
      actor_user_id: params.appellantUserId,
    })
  })
}

export function notifyAppealApproved(params: {
  ownerUserId: string
  adminUserId: string
  obsId: string
}): void {
  if (params.ownerUserId === params.adminUserId) return

  createNotification({
    user_id: params.ownerUserId,
    type: 'appeal_approved',
    title: '申诉已通过',
    content: '你的申诉已通过，观测记录已恢复展示',
    obs_id: params.obsId,
    actor_user_id: params.adminUserId,
  })
}

export function notifyAppealRejected(params: {
  ownerUserId: string
  adminUserId: string
  obsId: string
}): void {
  if (params.ownerUserId === params.adminUserId) return

  createNotification({
    user_id: params.ownerUserId,
    type: 'appeal_rejected',
    title: '申诉已驳回',
    content: '你的申诉未通过，记录仍将保持隐藏状态',
    obs_id: params.obsId,
    actor_user_id: params.adminUserId,
  })
}
