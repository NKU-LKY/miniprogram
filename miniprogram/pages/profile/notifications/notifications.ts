import {
  clearAllNotifications,
  ensureAdminAppealNotifications,
  ensureUserAppealResultNotifications,
  listUserNotifications,
  readAllNotifications,
  readNotification,
} from '../../../services/api/notification'
import { getCurrentUser } from '../../../utils/session'

interface NotificationView {
  notification_id: string
  type: string
  type_label: string
  type_icon: string
  title: string
  content: string
  obs_id: string
  is_read: boolean
  time_text: string
}

let loadSeq = 0

Page({
  data: {
    loading: true,
    notifications: [] as NotificationView[],
    unreadCount: 0,
  },

  onShow() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadNotifications(user.user_id)
    setTimeout(() => {
      this.syncAppealNotifications(user.user_id)
    }, 500)
  },

  loadNotifications(userId: string) {
    const seq = ++loadSeq
    this.setData({ loading: true })

    listUserNotifications(userId)
      .then((notifications) => {
        if (seq !== loadSeq) return
        this.setData({
          loading: false,
          ...this.buildNotificationDataFromList(notifications),
        })
      })
      .catch((err) => {
        if (seq !== loadSeq) return
        console.warn('loadNotifications failed:', err)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      })
  },

  syncAppealNotifications(userId: string) {
    const user = getCurrentUser()
    const syncTasks: Promise<void>[] = [
      ensureUserAppealResultNotifications(userId).catch((err) => {
        console.warn('ensureUserAppealResultNotifications failed:', err)
      }),
    ]
    if (user && user.role === 'admin') {
      syncTasks.push(
        ensureAdminAppealNotifications(userId).catch((err) => {
          console.warn('ensureAdminAppealNotifications failed:', err)
        }),
      )
    }

    Promise.all(syncTasks)
      .then(() => listUserNotifications(userId))
      .then((notifications) => {
        this.setData(this.buildNotificationDataFromList(notifications))
      })
      .catch((err) => {
        console.warn('syncAppealNotifications failed:', err)
      })
  },

  refreshNotifications(userId: string) {
    this.loadNotifications(userId)
    this.syncAppealNotifications(userId)
  },

  buildNotificationDataFromList(
    notifications: Awaited<ReturnType<typeof listUserNotifications>>,
  ) {
    return {
      notifications: (notifications || []).map((item) => ({
        notification_id: item.notification_id,
        type: item.type,
        type_label: item.type_label,
        type_icon: item.type_icon,
        title: item.title,
        content: item.content,
        obs_id: item.obs_id || '',
        is_read: item.is_read,
        time_text: item.time_text,
      })),
      unreadCount: (notifications || []).filter((item) => !item.is_read).length,
    }
  },

  onNotificationTap(e: WechatMiniprogram.TouchEvent) {
    const notificationId = e.currentTarget.dataset.id as string
    const obsId = e.currentTarget.dataset.obsId as string
    const type = e.currentTarget.dataset.type as string
    const user = getCurrentUser()
    if (!user || !notificationId) return

    readNotification(notificationId, user.user_id).then(() => {
      this.refreshNotifications(user.user_id)
    })

    if (type === 'appeal_received') {
      wx.navigateTo({ url: '/pages/admin/moderation/moderation?tab=appeals' })
      return
    }

    if (obsId) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
    }
  },

  onMarkAllNotificationsRead() {
    const user = getCurrentUser()
    if (!user || this.data.unreadCount <= 0) return

    readAllNotifications(user.user_id).then(() => {
      this.refreshNotifications(user.user_id)
      wx.showToast({ title: '已全部标为已读', icon: 'success' })
    })
  },

  onClearAllNotifications() {
    const user = getCurrentUser()
    if (!user || this.data.notifications.length <= 0) return

    wx.showModal({
      title: '清空通知',
      content: '确定清空全部消息通知吗？清空后无法恢复。',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return

        clearAllNotifications(user.user_id).then(() => {
          this.refreshNotifications(user.user_id)
          wx.showToast({ title: '已清空', icon: 'success' })
        })
      },
    })
  },
})
