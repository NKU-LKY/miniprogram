import {
  approveAppealForAdmin,
  countPendingAppealsForModeration,
  hideCommentForAdmin,
  restoreCommentForAdmin,
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
import { ensureAdminAppealNotifications } from '../../../services/api/notification'
import { getCurrentUser } from '../../../utils/session'

type ActiveTab = 'observations' | 'comments' | 'appeals'

function isAccessError<T>(result: T[] | { error: string }): result is { error: string } {
  return !Array.isArray(result)
}

let loadSeq = 0

Page({
  data: {
    loading: false,
    forbidden: false,
    activeTab: 'observations' as ActiveTab,
    obsList: [] as ModerationObsItem[],
    commentList: [] as ModerationCommentItem[],
    appealList: [] as ModerationAppealItem[],
    appealPendingCount: 0,
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

    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as WechatMiniprogram.Page.Instance<
      WechatMiniprogram.IAnyObject,
      { tab?: string }
    >
    const tab = page.options?.tab as ActiveTab | undefined
    if (tab === 'appeals' || tab === 'comments' || tab === 'observations') {
      this.loadData(tab)
      return
    }
    this.loadData(this.data.activeTab)
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as ActiveTab
    if (!tab || tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.loadData(tab)
  },

  loadData(tab?: ActiveTab) {
    const activeTab = tab || this.data.activeTab
    const seq = ++loadSeq
    this.setData({ loading: true, forbidden: false })

    const finish = () => {
      if (seq === loadSeq) {
        this.setData({ loading: false })
      }
    }

    const run = async () => {
      try {
        if (activeTab === 'observations') {
          const obsResult = await listObservationsForModeration()
          if (seq !== loadSeq) return
          if (isAccessError(obsResult)) {
            this.setData({ forbidden: true })
            return
          }
          this.setData({ obsList: obsResult })
          void countPendingAppealsForModeration().then((count) => {
            if (seq === loadSeq) {
              this.setData({ appealPendingCount: count })
            }
          })
          return
        }

        if (activeTab === 'comments') {
          const commentResult = await listCommentsForModeration()
          if (seq !== loadSeq) return
          if (isAccessError(commentResult)) {
            this.setData({ forbidden: true })
            return
          }
          this.setData({ commentList: commentResult })
          return
        }

        const current = getCurrentUser()
        if (current?.role === 'admin') {
          await ensureAdminAppealNotifications(current.user_id).catch((err) => {
            console.warn('ensureAdminAppealNotifications failed:', err)
          })
        }
        const appealResult = await listAppealsForModeration()
        if (seq !== loadSeq) return
        if (isAccessError(appealResult)) {
          wx.showToast({
            title: appealResult.error === '无权限访问' ? '无权限访问' : '加载失败',
            icon: 'none',
          })
          if (appealResult.error === '无权限访问') {
            this.setData({ forbidden: true })
          }
          return
        }
        this.setData({
          appealList: appealResult,
          appealPendingCount: appealResult.length,
        })
      } catch (err) {
        if (seq !== loadSeq) return
        console.error('loadData error:', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        finish()
      }
    }

    void run()
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
          this.loadData('observations')
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
          this.loadData('observations')
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
          this.loadData('observations')
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
          this.loadData('comments')
        })
      },
    })
  },

  onRestoreComment(e: WechatMiniprogram.TouchEvent) {
    const commentId = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '恢复评论',
      content: '恢复后该评论将重新对外展示，确定继续？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        restoreCommentForAdmin(commentId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已恢复展示', icon: 'success' })
          this.loadData('comments')
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
    this.loadData('appeals')
  },

  onApproveAppeal(e: WechatMiniprogram.TouchEvent) {
    const appealId = e.currentTarget.dataset.id as string
    const obsId = e.currentTarget.dataset.obsId as string
    const ownerUserId = e.currentTarget.dataset.ownerId as string
    wx.showModal({
      title: '取消隐藏',
      content: '确认通过申诉并恢复该记录的公开展示？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        approveAppealForAdmin(appealId, { ownerUserId, obsId }).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已恢复展示', icon: 'success' })
          this.loadData('appeals')
          void listObservationsForModeration().then((obsResult) => {
            if (!isAccessError(obsResult)) {
              this.setData({ obsList: obsResult })
            }
          })
        })
      },
    })
  },

  onRejectAppeal(e: WechatMiniprogram.TouchEvent) {
    const appealId = e.currentTarget.dataset.id as string
    const obsId = e.currentTarget.dataset.obsId as string
    const ownerUserId = e.currentTarget.dataset.ownerId as string
    wx.showModal({
      title: '驳回申诉',
      content: '确认驳回该申诉？记录仍将保持隐藏状态。',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        rejectAppealForAdmin(appealId, { ownerUserId, obsId }).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已驳回申诉', icon: 'success' })
          this.loadData('appeals')
        })
      },
    })
  },
})
