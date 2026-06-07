import type { Notification } from '../../types/notification'
import { getLocalItem, setLocalItem } from './storage'

const NOTIFICATIONS_KEY = 'notifications'

function generateNotificationId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getAllNotifications(): Notification[] {
  const stored = getLocalItem<Notification[]>(NOTIFICATIONS_KEY)
  return Array.isArray(stored) ? stored : []
}

function saveNotifications(list: Notification[]): Notification[] {
  setLocalItem(NOTIFICATIONS_KEY, list)
  return list
}

export function listNotificationsByUserId(userId: string): Notification[] {
  return getAllNotifications()
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function countUnreadNotifications(userId: string): number {
  return listNotificationsByUserId(userId).filter((item) => !item.is_read).length
}

export interface CreateNotificationInput {
  user_id: string
  type: Notification['type']
  title: string
  content: string
  obs_id?: string
  comment_id?: string
  actor_user_id?: string
}

export function createNotification(input: CreateNotificationInput): Notification {
  const notification: Notification = {
    notification_id: generateNotificationId(),
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    content: input.content,
    obs_id: input.obs_id,
    comment_id: input.comment_id,
    actor_user_id: input.actor_user_id,
    is_read: false,
    created_at: new Date().toISOString(),
  }

  const all = getAllNotifications()
  saveNotifications([notification, ...all])
  return notification
}

export function markNotificationRead(notificationId: string, userId: string): Notification | null {
  const all = getAllNotifications()
  const index = all.findIndex(
    (item) => item.notification_id === notificationId && item.user_id === userId,
  )
  if (index < 0 || all[index].is_read) return index >= 0 ? all[index] : null

  all[index] = { ...all[index], is_read: true }
  saveNotifications(all)
  return all[index]
}

export function markAllNotificationsRead(userId: string): number {
  const all = getAllNotifications()
  let count = 0

  const updated = all.map((item) => {
    if (item.user_id !== userId || item.is_read) return item
    count += 1
    return { ...item, is_read: true }
  })

  if (count > 0) {
    saveNotifications(updated)
  }

  return count
}

export function clearAllNotifications(userId: string): number {
  const all = getAllNotifications()
  const remaining = all.filter((item) => item.user_id !== userId)
  const removedCount = all.length - remaining.length

  if (removedCount > 0) {
    saveNotifications(remaining)
  }

  return removedCount
}
