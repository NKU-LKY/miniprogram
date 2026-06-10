import { getUserProfile } from '../../../services/api/profile'
import { canPublishObservation } from '../../../utils/permissions'
import { getCurrentUser } from '../../../utils/session'

interface RecordView {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  location_detail?: string
  species_name: string
  species_label: string
  status_label: string
  time_text: string
  like_count: number
  comment_count: number
  is_featured: boolean
}

Page({
  data: {
    loading: true,
    unavailable: false,
    records: [] as RecordView[],
    isObserver: false,
  },

  onShow() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadRecords(user.user_id)
  },

  loadRecords(userId: string) {
    const sessionUser = getCurrentUser()
    if (!sessionUser) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this.setData({ loading: true, unavailable: false })

    getUserProfile(userId, sessionUser)
      .then((profile) => {
        this.setData({
          loading: false,
          unavailable: false,
          records: (profile.records || []).map((item) => ({
            obs_id: item.obs_id,
            photo_url: item.photo_url,
            note: item.note || '',
            location_name: item.location_name,
            location_detail: item.location_detail,
            species_name: item.species_name || '',
            species_label: item.species_label || item.species_name || '',
            status_label: item.status_label || '',
            time_text: item.time_text,
            like_count: item.like_count,
            comment_count: item.comment_count,
            is_featured: item.is_featured,
          })),
          isObserver: canPublishObservation(sessionUser),
        })
      })
      .catch((err) => {
        console.error('loadRecords error:', err)
        this.setData({ loading: false, unavailable: true })
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      })
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },

  onGoPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },
})
