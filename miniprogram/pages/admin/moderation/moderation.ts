import {
  hideCommentForAdmin,
  hideObservationForAdmin,
  listCommentsForModeration,
  listObservationsForModeration,
  restoreObservationForAdmin,
  type ModerationCommentItem,
  type ModerationObsItem,
} from '../../../services/api/admin'
import { getCurrentUser } from '../../../utils/session'

type ActiveTab = 'observations' | 'comments'

Page({
  data: {
    loading: true,
    forbidden: false,
    activeTab: 'observations' as ActiveTab,
    obsList: [] as ModerationObsItem[],
    commentList: [] as ModerationCommentItem[],
  },

  onShow() {
    const current = getCurrentUser()
    if (!current || current.role !== 'admin') {
      this.setData({ loading: false, forbidden: true })
      return
    }
    this.loadData()
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as ActiveTab
    if (!tab || tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
  },

  loadData() {
    this.setData({ loading: true, forbidden: false })

    try {
      const obsResult = listObservationsForModeration()
      const commentResult = listCommentsForModeration()

      if ('error' in obsResult || 'error' in commentResult) {
        this.setData({ loading: false, forbidden: true })
        return
      }

      this.setData({
        obsList: obsResult,
        commentList: commentResult,
        loading: false,
      })
    } catch (err) {
      console.error('loadData error:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onHideObservation(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '隐藏记录',
      content: '隐藏后该记录将不再出现在公开列表中，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        const result = hideObservationForAdmin(obsId)
        if (!result.success) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已隐藏', icon: 'success' })
        this.loadData()
      },
    })
  },

  onRestoreObservation(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '恢复记录',
      content: '恢复后该记录将重新出现在公开列表中，确定继续？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        const result = restoreObservationForAdmin(obsId)
        if (!result.success) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已恢复', icon: 'success' })
        this.loadData()
      },
    })
  },

  onHideComment(e: WechatMiniprogram.TouchEvent) {
    const commentId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '隐藏评论',
      content: '隐藏后该评论将不再对外展示，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        const result = hideCommentForAdmin(commentId)
        if (!result.success) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已隐藏', icon: 'success' })
        this.loadData()
      },
    })
  },

  onGoDetail(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },
})
