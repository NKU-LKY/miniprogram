import type { NotificationItem } from '../../../types/notification'
import { request } from './client'
import { mapNotificationItem, toRemoteUserId } from './mappers'
import type { PaginatedResult, RemoteNotification } from './types'

export async function listUserNotificationsRemote(userId: string): Promise<NotificationItem[]> {
  const result = await request<PaginatedResult<RemoteNotification>>('/api/notifications', {
    query: { userId: toRemoteUserId(userId), page: 1, pageSize: 100 },
  })
  return result.list.map(mapNotificationItem)
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
