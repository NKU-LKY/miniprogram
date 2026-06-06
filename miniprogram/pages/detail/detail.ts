import { getObservationDetail } from '../../services/local/observation-api'
import {
  createObservationComment,
  toggleObservationLike,
} from '../../services/local/interaction-api'
import {
  hideCommentForAdmin,
  hideObservationForAdmin,
  restoreObservationForAdmin,
} from '../../services/api/admin'
import type { ObservationCommentItem } from '../../types/comment'
import type { ObservationDetailItem } from '../../types/observation'
import { getCurrentUser } from '../../utils/session'

interface DetailView {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name: string
  status_label: string
  time_text: string
  time_full: string
  like_count: number
  comment_count: number
  liked: boolean
  publisher_nickname: string
  publisher_avatar_url: string
  is_rejected: boolean
}

interface CommentView {
  comment_id: string
  content: string
  time_text: string
  author_nickname: string
  author_avatar_url: string
  is_expert: boolean
}

function toCommentView(item: ObservationCommentItem): CommentView {
  return {
    comment_id: item.comment_id,
    content: item.content,
    time_text: item.time_text,
    author_nickname: item.author_nickname,
    author_avatar_url: item.author_avatar_url,
    is_expert: item.is_expert,
  }
}

function toDetailView(item: ObservationDetailItem): DetailView {
  return {
    obs_id: item.obs_id,
    photo_url: item.photo_url,
    note: item.note || '暂无描述',
    location_name: item.location_name,
    species_name: item.species_name || '',
    status_label: item.status_label || '',
    time_text: item.time_text,
    time_full: item.time_full,
    like_count: item.like_count,
    comment_count: item.comment_count,
    liked: item.liked,
    publisher_nickname: item.publisher.nickname,
    publisher_avatar_url: item.publisher.avatar_url,
    is_rejected: item.status === 'rejected',
  }
}

Page({
  data: {
    loading: true,
    unavailable: false,
    obsId: '',
    detail: null as DetailView | null,
    comments: [] as CommentView[],
    commentInput: '',
    submitting: false,
    liking: false,
    isAdmin: false,
    isHidden: false,
  },

  onLoad(options: { id?: string }) {
    if (!getCurrentUser()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const obsId = options.id
    if (!obsId) {
      this.setData({ loading: false, unavailable: true })
      return
    }

    this.setData({ obsId })
    this.loadDetail(obsId)
  },

  loadDetail(obsId: string) {
    this.setData({ loading: true, unavailable: false })

    try {
      const user = getCurrentUser()
      const result = getObservationDetail(obsId, user && user.user_id)
      if (!result) {
        this.setData({ loading: false, unavailable: true, detail: null, comments: [] })
        return
      }

      this.setData({
        loading: false,
        unavailable: false,
        detail: toDetailView(result),
        comments: result.comments.map(toCommentView),
        isAdmin: Boolean(user && user.role === 'admin'),
        isHidden: result.status === 'rejected' || result.status === 'pending_review',
      })
    } catch (err) {
      console.error('loadDetail error:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false, unavailable: true, detail: null, comments: [] })
    }
  },

  onPreviewPhoto() {
    const detail = this.data.detail
    if (!detail) return
    wx.previewImage({
      current: detail.photo_url,
      urls: [detail.photo_url],
    })
  },

  onToggleLike() {
    if (this.data.liking || !this.data.detail) return

    const user = getCurrentUser()
    if (!user) return

    this.setData({ liking: true })

    try {
      const result = toggleObservationLike(this.data.obsId, user.user_id)
      if (!result) {
        wx.showToast({ title: '操作失败', icon: 'none' })
        return
      }

      this.setData({
        'detail.liked': result.liked,
        'detail.like_count': result.like_count,
      })
    } catch (err) {
      console.error('toggleLike error:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      this.setData({ liking: false })
    }
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ commentInput: e.detail.value })
  },

  onSubmitComment() {
    if (this.data.submitting || !this.data.detail) return

    const user = getCurrentUser()
    if (!user) return

    const content = this.data.commentInput.trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const result = createObservationComment(this.data.obsId, user.user_id, content)
      if ('error' in result) {
        wx.showToast({ title: result.error, icon: 'none' })
        return
      }

      this.setData({
        comments: this.data.comments.concat(toCommentView(result.comment)),
        commentInput: '',
        'detail.comment_count': result.comment_count,
      })
      wx.showToast({ title: '评论成功', icon: 'success' })
    } catch (err) {
      console.error('submitComment error:', err)
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onHideObservation() {
    wx.showModal({
      title: '隐藏记录',
      content: '隐藏后该记录将不再出现在公开列表中，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        const result = hideObservationForAdmin(this.data.obsId)
        if (!result.success) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已隐藏', icon: 'success' })
        this.loadDetail(this.data.obsId)
      },
    })
  },

  onRestoreObservation() {
    wx.showModal({
      title: '恢复记录',
      content: '恢复后该记录将重新出现在公开列表中，确定继续？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        const result = restoreObservationForAdmin(this.data.obsId)
        if (!result.success) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已恢复', icon: 'success' })
        this.loadDetail(this.data.obsId)
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
        this.loadDetail(this.data.obsId)
      },
    })
  },
})
