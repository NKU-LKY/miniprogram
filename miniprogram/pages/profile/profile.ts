import { getUserProfile } from '../../services/local/profile-api'
import {
  clearAllNotifications,
  listUserNotifications,
  readAllNotifications,
  readNotification,
} from '../../services/local/notification-api'
import {
  formatDiaryDateLabel,
  getDiaryChartWidth,
  getDiaryScrollIntoViewId,
  type ObservationDiary,
} from '../../utils/observation-diary'
import { canPublishObservation } from '../../utils/permissions'
import { getCurrentUser } from '../../utils/session'

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

interface RecordView {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name: string
  species_label: string
  status_label: string
  time_text: string
  like_count: number
  comment_count: number
  is_featured: boolean
}

interface SpeciesView {
  species_name: string
  marker_label: string
  record_count: number
  latest_time_text: string
}

interface DiaryDayView {
  date: string
  count: number
  level: number
  future: boolean
}

interface DiaryWeekView {
  week_index: number
  days: DiaryDayView[]
}

interface DiaryMonthLabelView {
  label: string
  week_index: number
}

Page({
  data: {
    loading: true,
    unavailable: false,
    nickname: '',
    avatarUrl: '',
    roleLabel: '',
    shareCount: 0,
    totalLikes: 0,
    speciesCount: 0,
    records: [] as RecordView[],
    speciesList: [] as SpeciesView[],
    isObserver: false,
    notifications: [] as NotificationView[],
    unreadCount: 0,
    diaryWeeks: [] as DiaryWeekView[],
    diaryMonthLabels: [] as DiaryMonthLabelView[],
    diaryWeekdayLabels: [] as string[],
    diaryTotalRecords: 0,
    diaryActiveDays: 0,
    diaryChartWidth: 0,
    diaryScrollIntoView: '',
  },

  onShow() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadProfile(user.user_id)
    this.refreshNotifications(user.user_id)
  },

  refreshNotifications(userId: string) {
    this.setData(this.buildNotificationData(userId))
  },

  loadProfile(userId: string) {
    this.setData({ loading: true, unavailable: false })

    try {
      const profile = getUserProfile(userId)
      if (!profile) {
        this.setData({ loading: false, unavailable: true })
        return
      }

      this.setData({
        loading: false,
        unavailable: false,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url,
        roleLabel: profile.role_label,
        shareCount: profile.stats.share_count,
        totalLikes: profile.stats.total_likes,
        speciesCount: profile.stats.species_count,
        records: profile.records.map((item) => ({
          obs_id: item.obs_id,
          photo_url: item.photo_url,
          note: item.note || '',
          location_name: item.location_name,
          species_name: item.species_name || '',
          species_label: item.species_label || item.species_name || '',
          status_label: item.status_label || '',
          time_text: item.time_text,
          like_count: item.like_count,
          comment_count: item.comment_count,
          is_featured: item.is_featured,
        })),
        speciesList: profile.species_list.map((item) => ({
          species_name: item.species_name,
          marker_label: item.marker_label,
          record_count: item.record_count,
          latest_time_text: item.latest_time_text,
        })),
        isObserver: canPublishObservation(getCurrentUser()),
        ...this.buildNotificationData(userId),
        ...this.buildDiaryData(profile.diary),
      })
    } catch (err) {
      console.error('loadProfile error:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false, unavailable: true })
    }
  },

  buildNotificationData(userId: string) {
    const notifications = listUserNotifications(userId)
    return {
      notifications: notifications.map((item) => ({
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
      unreadCount: notifications.filter((item) => !item.is_read).length,
    }
  },

  buildDiaryData(diary: ObservationDiary) {
    const weekCount = diary.weeks.length
    return {
      diaryWeeks: diary.weeks,
      diaryMonthLabels: diary.month_labels,
      diaryWeekdayLabels: diary.weekday_labels,
      diaryTotalRecords: diary.total_records,
      diaryActiveDays: diary.active_days,
      diaryChartWidth: getDiaryChartWidth(weekCount),
      diaryScrollIntoView: getDiaryScrollIntoViewId(weekCount),
    }
  },

  onNotificationTap(e: WechatMiniprogram.TouchEvent) {
    const notificationId = e.currentTarget.dataset.id as string
    const obsId = e.currentTarget.dataset.obsId as string
    const type = e.currentTarget.dataset.type as string
    const user = getCurrentUser()
    if (!user || !notificationId) return

    readNotification(notificationId, user.user_id)
    this.setData(this.buildNotificationData(user.user_id))

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

    readAllNotifications(user.user_id)
    this.setData(this.buildNotificationData(user.user_id))
    wx.showToast({ title: '已全部标为已读', icon: 'success' })
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

        clearAllNotifications(user.user_id)
        this.setData(this.buildNotificationData(user.user_id))
        wx.showToast({ title: '已清空', icon: 'success' })
      },
    })
  },

  onGoPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  onDiaryCellTap(e: WechatMiniprogram.TouchEvent) {
    const date = e.currentTarget.dataset.date as string
    const count = Number(e.currentTarget.dataset.count || 0)
    const future = Boolean(e.currentTarget.dataset.future)
    if (!date || future) return

    const label = formatDiaryDateLabel(date)
    wx.showToast({
      title: count > 0 ? `${label} 发布 ${count} 条` : `${label} 无发布`,
      icon: 'none',
    })
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },

  onSpeciesTap(e: WechatMiniprogram.TouchEvent) {
    const speciesName = e.currentTarget.dataset.name as string
    if (!speciesName) return
    wx.navigateTo({ url: `/pages/species/species?name=${encodeURIComponent(speciesName)}` })
  },
})
