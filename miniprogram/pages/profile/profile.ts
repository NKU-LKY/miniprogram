import { getUserProfile } from '../../services/api/profile'
import {
  ensureAdminAppealNotifications,
  ensureUserAppealResultNotifications,
  listUserNotifications,
  readNotification,
} from '../../services/api/notification'
import {
  formatDiaryDateLabel,
  getDiaryChartWidth,
  getDiaryScrollIntoViewId,
  type ObservationDiary,
} from '../../utils/observation-diary'
import { canPublishObservation } from '../../utils/permissions'
import { getCurrentUser } from '../../utils/session'
import type { UserProfileData } from '../../services/api/profile'

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

const PREVIEW_LIMIT = 3

let loadSeq = 0

Page({
  _profileReady: false,
  _pageLoading: false,

  data: {
    loading: true,
    unavailable: false,
    nickname: '',
    avatarUrl: '',
    roleLabel: '',
    shareCount: 0,
    totalLikes: 0,
    speciesCount: 0,
    previewRecords: [] as RecordView[],
    speciesList: [] as SpeciesView[],
    isObserver: false,
    previewNotifications: [] as NotificationView[],
    notificationTotal: 0,
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

    if (this._profileReady) {
      this.loadNotifications(user.user_id)
      return
    }

    if (this._pageLoading) return
    this.loadPage(user.user_id)
  },

  onRetryLoad() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this._profileReady = false
    this._pageLoading = false
    loadSeq += 1
    this.loadPage(user.user_id)
  },

  markUnavailable() {
    if (this._profileReady) return
    this.setData({ loading: false, unavailable: true })
  },

  loadPage(userId: string) {
    if (this._pageLoading) return

    const seq = ++loadSeq
    const sessionUser = getCurrentUser()
    if (!sessionUser) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this._pageLoading = true
    if (!this._profileReady) {
      this.setData({ loading: true, unavailable: false })
    }

    getUserProfile(userId, sessionUser)
      .then((profile) => {
        if (seq !== loadSeq) return

        try {
          this.applyProfile(profile)
          this._profileReady = true
        } catch (err) {
          console.error('applyProfile error:', err)
          this.markUnavailable()
          wx.showToast({ title: '加载失败，请重试', icon: 'none' })
          return
        }

        this.loadNotifications(userId, seq)
        setTimeout(() => {
          if (seq === loadSeq) {
            this.syncAppealNotifications(userId, seq)
          }
        }, 500)
      })
      .catch((err) => {
        if (seq !== loadSeq) return
        console.error('loadPage error:', err)
        this.markUnavailable()
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      })
      .finally(() => {
        if (seq === loadSeq) {
          this._pageLoading = false
        }
      })
  },

  applyProfile(profile: UserProfileData) {
    const diaryData = this.buildDiaryData(profile.diary)

    this.setData({
      loading: false,
      unavailable: false,
      nickname: profile.nickname,
      avatarUrl: profile.avatar_url,
      roleLabel: profile.role_label,
      shareCount: profile.stats.share_count,
      totalLikes: profile.stats.total_likes,
      speciesCount: profile.stats.species_count,
      previewRecords: (profile.records || []).slice(0, PREVIEW_LIMIT).map((item) => ({
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
      speciesList: (profile.species_list || []).map((item) => ({
        species_name: item.species_name,
        marker_label: item.marker_label,
        record_count: item.record_count,
        latest_time_text: item.latest_time_text,
      })),
      isObserver: canPublishObservation(getCurrentUser()),
      diaryWeeks: diaryData.diaryWeeks,
      diaryMonthLabels: diaryData.diaryMonthLabels,
      diaryWeekdayLabels: diaryData.diaryWeekdayLabels,
      diaryTotalRecords: diaryData.diaryTotalRecords,
      diaryActiveDays: diaryData.diaryActiveDays,
      diaryChartWidth: diaryData.diaryChartWidth,
      diaryScrollIntoView: '',
    })

    if (diaryData.diaryScrollIntoView) {
      wx.nextTick(() => {
        this.setData({ diaryScrollIntoView: diaryData.diaryScrollIntoView })
      })
    }
  },

  loadNotifications(userId: string, seq = loadSeq) {
    listUserNotifications(userId)
      .then((notifications) => {
        if (seq !== loadSeq && seq !== 0) return
        this.setData(this.buildNotificationDataFromList(notifications))
      })
      .catch((err) => {
        console.warn('loadNotifications failed:', err)
      })
  },

  syncAppealNotifications(userId: string, seq = loadSeq) {
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
        if (seq !== loadSeq) return
        this.setData(this.buildNotificationDataFromList(notifications))
      })
      .catch((err) => {
        console.warn('syncAppealNotifications failed:', err)
      })
  },

  refreshNotifications(userId: string) {
    this.loadNotifications(userId, 0)
    this.syncAppealNotifications(userId, loadSeq)
  },

  buildNotificationDataFromList(notifications: Awaited<ReturnType<typeof listUserNotifications>>) {
    const list = (notifications || []).map((item) => ({
      notification_id: item.notification_id,
      type: item.type,
      type_label: item.type_label,
      type_icon: item.type_icon,
      title: item.title,
      content: item.content,
      obs_id: item.obs_id || '',
      is_read: item.is_read,
      time_text: item.time_text,
    }))
    return {
      previewNotifications: list.slice(0, PREVIEW_LIMIT),
      notificationTotal: list.length,
      unreadCount: list.filter((item) => !item.is_read).length,
    }
  },

  buildDiaryData(diary: ObservationDiary | undefined) {
    if (!diary || !Array.isArray(diary.weeks)) {
      return {
        diaryWeeks: [] as DiaryWeekView[],
        diaryMonthLabels: [] as DiaryMonthLabelView[],
        diaryWeekdayLabels: [] as string[],
        diaryTotalRecords: 0,
        diaryActiveDays: 0,
        diaryChartWidth: 0,
        diaryScrollIntoView: '',
      }
    }

    const weekCount = diary.weeks.length
    return {
      diaryWeeks: diary.weeks,
      diaryMonthLabels: diary.month_labels || [],
      diaryWeekdayLabels: diary.weekday_labels || [],
      diaryTotalRecords: diary.total_records || 0,
      diaryActiveDays: diary.active_days || 0,
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

  onViewAllNotifications() {
    wx.navigateTo({ url: '/pages/profile/notifications/notifications' })
  },

  onViewAllRecords() {
    wx.navigateTo({ url: '/pages/profile/records/records' })
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
