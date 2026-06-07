import {
  claimIdentification,
  listIdentificationQueue,
  releaseIdentification,
} from '../../../services/local/identification-api'
import type { IdentificationQueueItem } from '../../../services/local/identification-api'
import { getCurrentUser } from '../../../utils/session'

Page({
  data: {
    loading: true,
    forbidden: false,
    queueList: [] as IdentificationQueueItem[],
    pendingCount: 0,
    claimingId: '',
    releasingId: '',
  },

  onShow() {
    const user = getCurrentUser()
    if (!user || user.role !== 'reviewer') {
      this.setData({ loading: false, forbidden: true })
      return
    }
    this.loadQueue(user.user_id)
  },

  loadQueue(reviewerId: string) {
    this.setData({ loading: true, forbidden: false })

    try {
      const queueList = listIdentificationQueue(reviewerId)
      this.setData({
        queueList,
        pendingCount: queueList.length,
        loading: false,
      })
    } catch (err) {
      console.error('loadQueue error:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onClaim(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    const user = getCurrentUser()
    if (!obsId || !user || this.data.claimingId) return

    this.setData({ claimingId: obsId })

    try {
      const result = claimIdentification(obsId, user.user_id)
      if (!result.success) {
        wx.showToast({ title: result.message, icon: 'none' })
        return
      }
      wx.showToast({ title: '认领成功', icon: 'success' })
      this.loadQueue(user.user_id)
    } catch (err) {
      console.error('onClaim error:', err)
      wx.showToast({ title: '认领失败', icon: 'none' })
    } finally {
      this.setData({ claimingId: '' })
    }
  },

  onRelease(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    const user = getCurrentUser()
    if (!obsId || !user || this.data.releasingId) return

    wx.showModal({
      title: '释放认领',
      content: '释放后其他审阅员可以认领该记录，确定继续？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return

        this.setData({ releasingId: obsId })

        try {
          const result = releaseIdentification(obsId, user.user_id)
          if (!result.success) {
            wx.showToast({ title: result.message, icon: 'none' })
            return
          }
          wx.showToast({ title: '已释放', icon: 'success' })
          this.loadQueue(user.user_id)
        } catch (err) {
          console.error('onRelease error:', err)
          wx.showToast({ title: '释放失败', icon: 'none' })
        } finally {
          this.setData({ releasingId: '' })
        }
      },
    })
  },

  onGoDetail(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },
})
