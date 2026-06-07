import type { NotificationItem } from '../../types/notification'
import {
  clearAllNotifications as localClearAllNotifications,
  getUnreadNotificationCount as localGetUnreadNotificationCount,
  listUserNotifications as localListUserNotifications,
  readAllNotifications as localReadAllNotifications,
  readNotification as localReadNotification,
} from '../local/notification-api'
import { USE_LOCAL_BACKEND } from './config'

export function listUserNotifications(userId: string): Promise<NotificationItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程通知 API 待实现'))
  }
  return Promise.resolve(localListUserNotifications(userId))
}

export function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程通知 API 待实现'))
  }
  return Promise.resolve(localGetUnreadNotificationCount(userId))
}

export function readNotification(
  notificationId: string,
  userId: string,
): Promise<NotificationItem | null> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程通知 API 待实现'))
  }
  return Promise.resolve(localReadNotification(notificationId, userId))
}

export function readAllNotifications(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程通知 API 待实现'))
  }
  return Promise.resolve(localReadAllNotifications(userId))
}

export function clearAllNotifications(userId: string): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程通知 API 待实现'))
  }
  return Promise.resolve(localClearAllNotifications(userId))
}
