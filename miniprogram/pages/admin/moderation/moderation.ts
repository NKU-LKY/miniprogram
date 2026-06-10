import {
  approveAppealForAdmin,
  hideCommentForAdmin,
  hideObservationForAdmin,
  listAppealsForModeration,
  listCommentsForModeration,
  listObservationsForModeration,
  rejectAppealForAdmin,
  restoreObservationForAdmin,
  setObservationFeaturedForAdmin,
  type ModerationAppealItem,
  type ModerationCommentItem,
  type ModerationObsItem,
} from '../../../services/api/admin'
import { getCurrentUser } from '../../../utils/session'

type ActiveTab = 'observations' | 'comments' | 'appeals'

function isAccessError<T>(result: T[] | { error: string }): result is { error: string } {
  return !Array.isArray(result)
}

function readTabOption(): ActiveTab | undefined {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as WechatMiniprogram.Page.Instance<
    WechatMiniprogram.IAnyObject,
    { tab?: string }
  >
  const tab = page.options && page.options.tab
  if (tab === 'appeals' || tab === 'comments' || tab === 'observations') {
    return tab
  }
  return undefined
}

Page({
  data: {
    loading: true,
    forbidden: false,
    activeTab: 'observations' as ActiveTab,
    obsList: [] as ModerationObsItem[],
    commentList: [] as ModerationCommentItem[],
    appealList: [] as ModerationAppealItem[],
  },

  onLoad(options: { tab?: string }) {
    const tab = options.tab as ActiveTab | undefined
    if (tab === 'appeals' || tab === 'comments' || tab === 'observations') {
      this.setData({ activeTab: tab })
    }
  },

  onShow() {
    const current = getCurrentUser()
    if (!current || current.role !== 'admin') {
      this.setData({ loading: false, forbidden: true })
      return
    }

    const tab = readTabOption()
    if (tab) {
      this.setData({ activeTab: tab })
    }
    this.loadData()
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as ActiveTab
    if (!tab || tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true, forbidden: false })

    Promise.all([
      listObservationsForModeration(),
      listCommentsForModeration(),
      listAppealsForModeration(),
    ])
      .then(([obsResult, commentResult, appealResult]) => {
        if (
          isAccessError(obsResult) ||
          isAccessError(commentResult) ||
          isAccessError(appealResult)
        ) {
          this.setData({ loading: false, forbidden: true })
          return
        }

        this.setData({
          obsList: obsResult,
          commentList: commentResult,
          appealList: appealResult,
          loading: false,
        })
      })
      .catch((err) => {
        console.error('loadData error:', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
      })
  },

  onHideObservation(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '隐藏记录',
      content: '隐藏后该记录将不再出现在公开列表中，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        hideObservationForAdmin(obsId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已隐藏', icon: 'success' })
          this.loadData()
        })
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
        restoreObservationForAdmin(obsId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已恢复', icon: 'success' })
          this.loadData()
        })
      },
    })
  },

  onToggleFeatured(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    const action = e.currentTarget.dataset.action as string
    const featured = action === 'set'
    const item = this.data.obsList.find((obs) => obs.obs_id === obsId)
    if (!item || item.is_hidden) return

    wx.showModal({
      title: featured ? '设为精选' : '取消精选',
      content: featured
        ? '精选记录将在列表中展示特殊标识，并支持筛选查看。'
        : '确定取消该记录的精选标记？',
      confirmColor: '#a67c00',
      success: (res) => {
        if (!res.confirm) return
        setObservationFeaturedForAdmin(obsId, featured).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: featured ? '已设为精选' : '已取消精选', icon: 'success' })
          this.loadData()
        })
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
        hideCommentForAdmin(commentId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已隐藏', icon: 'success' })
          this.loadData()
        })
      },
    })
  },

  onGoDetail(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },

  onGoAppealsTab() {
    this.setData({ activeTab: 'appeals' })
    this.loadData()
  },

  onApproveAppeal(e: WechatMiniprogram.TouchEvent) {
    const appealId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '取消隐藏',
      content: '确认通过申诉并恢复该记录的公开展示？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        approveAppealForAdmin(appealId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已恢复展示', icon: 'success' })
          this.loadData()
        })
      },
    })
  },

  onRejectAppeal(e: WechatMiniprogram.TouchEvent) {
    const appealId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '驳回申诉',
      content: '确认驳回该申诉？记录仍将保持隐藏状态。',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        rejectAppealForAdmin(appealId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已驳回申诉', icon: 'success' })
          this.loadData()
        })
      },
    })
  },
})
