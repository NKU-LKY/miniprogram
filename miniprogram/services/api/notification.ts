import type { NotificationItem } from '../../types/notification'
import {
  clearAllNotifications as localClearAllNotifications,
  getUnreadNotificationCount as localGetUnreadNotificationCount,
  listUserNotifications as localListUserNotifications,
  readAllNotifications as localReadAllNotifications,
  readNotification as localReadNotification,
} from '../local/notification-api'
import { USE_LOCAL_BACKEND } from './config'
import {
  clearAllNotificationsRemote,
  getUnreadNotificationCountRemote,
  listUserNotificationsRemote,
  readAllNotificationsRemote,
  readNotificationRemote,
} from './remote/notification'

export function listUserNotifications(userId: string): Promise<NotificationItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return listUserNotificationsRemote(userId)
  }
  return Promise.resolve(localListUserNotifications(userId))
}

export function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return getUnreadNotificationCountRemote(userId)
  }
  return Promise.resolve(localGetUnreadNotificationCount(userId))
}

export function readNotification(
  notificationId: string,
  userId: string,
): Promise<NotificationItem | null> {
  if (!USE_LOCAL_BACKEND) {
    return readNotificationRemote(notificationId, userId)
  }
  return Promise.resolve(localReadNotification(notificationId, userId))
}

export function readAllNotifications(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return readAllNotificationsRemote(userId)
  }
  return Promise.resolve(localReadAllNotifications(userId))
}

export function clearAllNotifications(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return clearAllNotificationsRemote(userId)
  }
  return Promise.resolve(localClearAllNotifications(userId))
}
