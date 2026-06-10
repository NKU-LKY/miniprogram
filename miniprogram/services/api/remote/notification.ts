import type { NotificationItem } from '../../../types/notification'
import { request } from './client'
import { mapNotificationItem, toRemoteUserId, toUserId } from './mappers'
import type { PaginatedResult, RemoteAppeal, RemoteComment, RemoteNotification, RemotePost, RemoteUser } from './types'

function truncatePreview(text: string, maxLen = 40): string {
  const trimmed = text.trim()
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed
}

export const APPEAL_APPROVED_CONTENT = '你的申诉已通过，观测记录已恢复展示'
export const APPEAL_REJECTED_CONTENT = '你的申诉未通过，记录仍将保持隐藏状态'

function isAppealResultNotification(notification: RemoteNotification): boolean {
  const content = notification.content || ''
  return (
    notification.type === 'system_notice' &&
    (content.startsWith('你的申诉已通过') || content.startsWith('你的申诉未通过'))
  )
}

export async function createNotificationRemote(params: {
  userId: string | number
  type: string
  sourceUserId?: string | number
  targetId?: string | number
  content?: string
}): Promise<void> {
  const data: Record<string, unknown> = {
    userId: toRemoteUserId(String(params.userId)),
    type: params.type,
  }
  if (params.sourceUserId !== undefined && params.sourceUserId !== null && params.sourceUserId !== '') {
    data.sourceUserId = toRemoteUserId(String(params.sourceUserId))
  }
  if (params.targetId !== undefined && params.targetId !== null && params.targetId !== '') {
    data.targetId = Number(params.targetId)
  }
  if (params.content) {
    data.content = params.content
  }

  await request('/api/notifications', {
    method: 'POST',
    data,
  })
}

async function enrichNotificationItem(notification: RemoteNotification): Promise<NotificationItem> {
  const item = mapNotificationItem(notification)
  if (!notification.targetId) return item

  if (notification.type === 'comment_reply' || notification.type === 'comment_like') {
    const comment = await request<RemoteComment>(`/api/comments/${notification.targetId}`).catch(() => null)
    if (comment) {
      const post = await request<RemotePost>(`/api/posts/${comment.postId}`).catch(() => null)
      const obsId = post?.observation?.obsId
      return {
        ...item,
        obs_id: obsId ? toUserId(obsId) : item.obs_id,
        comment_id: toUserId(comment.commentId),
      }
    }
    return { ...item, obs_id: toUserId(notification.targetId) }
  }

  if (item.obs_id) return item

  if (isAppealResultNotification(notification)) {
    return { ...item, obs_id: toUserId(notification.targetId) }
  }

  if (notification.type === 'comment_post') {
    const post = await request<RemotePost>(`/api/posts/${notification.targetId}`).catch(() => null)
    const obsId = post?.observation?.obsId
    if (obsId) {
      return { ...item, obs_id: toUserId(obsId) }
    }
    return { ...item, obs_id: toUserId(notification.targetId) }
  }

  return item
}

export async function listUserNotificationsRemote(userId: string): Promise<NotificationItem[]> {
  const result = await request<PaginatedResult<RemoteNotification>>('/api/notifications', {
    query: { userId: toRemoteUserId(userId), page: 1, pageSize: 100 },
  })
  const list = result?.list ?? []
  const items = await Promise.all(
    list.map((notification) =>
      enrichNotificationItem(notification).catch((err) => {
        console.warn('enrichNotificationItem failed:', err)
        return mapNotificationItem(notification)
      }),
    ),
  )
  return items
}

export async function getUnreadNotificationCountRemote(userId: string): Promise<number> {
  const data = await request<{ unreadCount: number }>('/api/notifications/unread-count', {
    query: { userId: toRemoteUserId(userId) },
  })
  return data.unreadCount
}

export async function readNotificationRemote(
  notificationId: string,
  userId: string,
): Promise<NotificationItem | null> {
  await request(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    data: { userId: toRemoteUserId(userId) },
  })

  const list = await listUserNotificationsRemote(userId)
  return list.find((item) => item.notification_id === notificationId) || null
}

export async function readAllNotificationsRemote(userId: string): Promise<number> {
  await request('/api/notifications/read-all', {
    method: 'PUT',
    data: { userId: toRemoteUserId(userId) },
  })
  return 0
}

export async function clearAllNotificationsRemote(userId: string): Promise<number> {
  const list = await listUserNotificationsRemote(userId)
  await Promise.all(
    list.map((item) =>
      request(`/api/notifications/${item.notification_id}`, {
        method: 'DELETE',
        data: { userId: toRemoteUserId(userId) },
      }).catch(() => undefined),
    ),
  )
  return list.length
}

export { truncatePreview as truncateNotificationPreview }

export async function notifyCommentPostRemote(params: {
  ownerUserId: string | number
  commenterUserId: string | number
  obsId: string | number
  content: string
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.commenterUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'comment_post',
    sourceUserId: params.commenterUserId,
    targetId: params.obsId,
    content: truncatePreview(params.content),
  })
}

export async function notifyCommentReplyRemote(params: {
  replyToUserId: string | number
  commenterUserId: string | number
  obsId: string | number
  content: string
}): Promise<void> {
  if (toUserId(params.replyToUserId) === toUserId(params.commenterUserId)) return

  await createNotificationRemote({
    userId: params.replyToUserId,
    type: 'comment_reply',
    sourceUserId: params.commenterUserId,
    targetId: params.obsId,
    content: truncatePreview(params.content),
  })
}

export async function notifyPostLikeRemote(params: {
  ownerUserId: string | number
  likerUserId: string | number
  obsId: string | number
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.likerUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'post_like',
    sourceUserId: params.likerUserId,
    targetId: params.obsId,
    content: '有人赞了你的观测记录',
  })
}

export async function notifyCommentLikeRemote(params: {
  commentAuthorUserId: string | number
  likerUserId: string | number
  obsId: string | number
}): Promise<void> {
  if (toUserId(params.commentAuthorUserId) === toUserId(params.likerUserId)) return

  await createNotificationRemote({
    userId: params.commentAuthorUserId,
    type: 'comment_like',
    sourceUserId: params.likerUserId,
    targetId: params.obsId,
    content: '有人赞了你的评论',
  })
}

export async function notifyObservationHiddenRemote(params: {
  ownerUserId: string | number
  adminUserId: string | number
  obsId: string | number
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.adminUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'observation_rejected',
    sourceUserId: params.adminUserId,
    targetId: params.obsId,
    content: '你发布的观测记录已被管理员隐藏，如有异议可在详情页提交申诉',
  })
}

export async function notifyAppealApprovedRemote(params: {
  ownerUserId: string | number
  adminUserId: string | number
  obsId: string | number
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.adminUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'system_notice',
    sourceUserId: params.adminUserId,
    targetId: params.obsId,
    content: APPEAL_APPROVED_CONTENT,
  })
}

export async function notifyAppealRejectedRemote(params: {
  ownerUserId: string | number
  adminUserId: string | number
  obsId: string | number
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.adminUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'system_notice',
    sourceUserId: params.adminUserId,
    targetId: params.obsId,
    content: APPEAL_REJECTED_CONTENT,
  })
}

export async function notifyIdentificationCompletedRemote(params: {
  ownerUserId: string | number
  reviewerUserId: string | number
  obsId: string | number
  content: string
}): Promise<void> {
  if (toUserId(params.ownerUserId) === toUserId(params.reviewerUserId)) return

  await createNotificationRemote({
    userId: params.ownerUserId,
    type: 'identification_completed',
    sourceUserId: params.reviewerUserId,
    targetId: params.obsId,
    content: params.content,
  })
}

async function listActiveAdminUsersRemote(): Promise<RemoteUser[]> {
  try {
    const result = await request<PaginatedResult<RemoteUser>>('/api/users', {
      query: { page: 1, pageSize: 200, role: 'admin', status: 'active' },
    })
    const admins = result?.list || []
    if (admins.length > 0) return admins
  } catch (err) {
    console.warn('list admins with role filter failed:', err)
  }

  try {
    const result = await request<PaginatedResult<RemoteUser>>('/api/users', {
      query: { page: 1, pageSize: 200, status: 'active' },
    })
    return (result?.list || []).filter((user) => user.role === 'admin')
  } catch (err) {
    console.warn('list admins fallback failed:', err)
    return []
  }
}

function isAppealAdminNotification(notification: RemoteNotification): boolean {
  return Boolean(
    notification.content &&
      (notification.content.startsWith('收到隐藏申诉') || notification.content.startsWith('收到申诉')),
  )
}

export async function notifyAdminsAppealReceivedRemote(params: {
  appellantUserId: string | number
  obsId: string | number
  appealId: string | number
  reason: string
}): Promise<void> {
  const admins = await listActiveAdminUsersRemote()
  if (admins.length === 0) {
    console.warn('notifyAdminsAppealReceivedRemote: no active admin found')
    return
  }

  const preview = truncatePreview(params.reason)
  const content = `收到隐藏申诉：${preview}`

  await Promise.all(
    admins.map((admin) => {
      if (toUserId(admin.userId) === toUserId(params.appellantUserId)) return Promise.resolve()
      return createNotificationRemote({
        userId: admin.userId,
        type: 'system_notice',
        sourceUserId: params.appellantUserId,
        targetId: params.appealId,
        content,
      }).catch((err) => console.warn('create appeal notification failed:', err))
    }),
  )
}

function hasAppealResultNotification(
  notifications: RemoteNotification[],
  obsId: string | number,
  approved: boolean,
): boolean {
  return notifications.some((item) => {
    if (!isAppealResultNotification(item)) return false
    if (String(item.targetId) !== String(obsId)) return false
    const content = item.content || ''
    return approved ? content.startsWith('你的申诉已通过') : content.startsWith('你的申诉未通过')
  })
}

/** 用户打开个人中心时，补发遗漏的申诉处理结果通知 */
export async function ensureUserAppealResultNotificationsRemote(userId: string): Promise<void> {
  try {
    const [appealsResult, notificationsResult] = await Promise.all([
      request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
        query: { page: 1, pageSize: 100, userId: toRemoteUserId(userId) },
      }),
      request<PaginatedResult<RemoteNotification>>('/api/notifications', {
        query: { userId: toRemoteUserId(userId), page: 1, pageSize: 100 },
      }),
    ])

    const processedAppeals = (appealsResult?.list || []).filter(
      (appeal) => appeal.status === 'approved' || appeal.status === 'rejected',
    )
    if (processedAppeals.length === 0) return

    const existingNotifications = notificationsResult?.list || []

    for (const appeal of processedAppeals) {
      const post = await request<RemotePost>(`/api/posts/${appeal.postId}`).catch(() => null)
      const obsId = post?.observation?.obsId
      if (!obsId) continue

      const approved = appeal.status === 'approved'
      if (hasAppealResultNotification(existingNotifications, obsId, approved)) continue

      const reviewerId = appeal.reviewer?.userId
      if (!reviewerId) continue

      const notify = approved ? notifyAppealApprovedRemote : notifyAppealRejectedRemote
      try {
        await notify({
          ownerUserId: userId,
          adminUserId: reviewerId,
          obsId,
        })
        existingNotifications.push({
          type: 'system_notice',
          targetId: Number(obsId),
          content: approved ? APPEAL_APPROVED_CONTENT : APPEAL_REJECTED_CONTENT,
        } as RemoteNotification)
      } catch (err) {
        console.warn('backfill appeal result notification failed:', err)
      }
    }
  } catch (err) {
    console.warn('ensureUserAppealResultNotificationsRemote failed:', err)
  }
}

/** 管理员打开通知/申诉页时，补发遗漏的待处理申诉通知 */
export async function ensureAdminAppealNotificationsRemote(adminUserId: string): Promise<void> {
  try {
    const [appealsResult, notificationsResult] = await Promise.all([
      request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
        query: { page: 1, pageSize: 100, status: 'pending' },
      }),
      request<PaginatedResult<RemoteNotification>>('/api/notifications', {
        query: { userId: toRemoteUserId(adminUserId), page: 1, pageSize: 100 },
      }),
    ])

    const pendingAppeals = appealsResult?.list || []
    if (pendingAppeals.length === 0) return

    const notifiedAppealIds = new Set(
      (notificationsResult?.list || [])
        .filter(isAppealAdminNotification)
        .map((item) => String(item.targetId)),
    )

    await Promise.all(
      pendingAppeals.map((appeal) => {
        if (notifiedAppealIds.has(String(appeal.appealId))) return Promise.resolve()
        return createNotificationRemote({
          userId: adminUserId,
          type: 'system_notice',
          sourceUserId: appeal.user?.userId,
          targetId: appeal.appealId,
          content: `收到隐藏申诉：${truncatePreview(appeal.reason)}`,
        }).catch((err) => console.warn('backfill appeal notification failed:', err))
      }),
    )
  } catch (err) {
    console.warn('ensureAdminAppealNotificationsRemote failed:', err)
  }
}
