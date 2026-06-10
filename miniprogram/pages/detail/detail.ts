import {
  createObservationComment,
  getObservationDetail,
  listObservationCommentThreads,
  setObservationCommentsEnabled,
  toggleObservationLike,
  withdrawObservation,
} from '../../services/api/observation'
import { getOwnerAppealForObs, submitObservationAppeal } from '../../services/api/appeal'
import {
  claimIdentification,
  completeIdentification,
  getIdentificationState,
  releaseIdentification,
} from '../../services/api/identification'
import { validateCommentContent } from '../../utils/content-filter'
import {
  hideCommentForAdmin,
  hideObservationForAdmin,
  restoreObservationForAdmin,
  setObservationFeaturedForAdmin,
} from '../../services/api/admin'
import type { ObservationCommentThreadItem } from '../../types/comment'
import type { ObservationDetailItem } from '../../types/observation'
import { getSpeciesCategoryIndex, SPECIES_CATEGORIES } from '../../data/species-categories'
import { formatSpeciesLabel } from '../../utils/species-display'
import { canIdentifySpecies } from '../../utils/permissions'
import { getCurrentUser } from '../../utils/session'

interface DetailView {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  location_detail: string
  species_name: string
  species_remark: string
  species_label: string
  status: string
  status_label: string
  time_text: string
  time_full: string
  like_count: number
  comment_count: number
  liked: boolean
  publisher_nickname: string
  publisher_avatar_url: string
  is_rejected: boolean
  is_featured: boolean
}

interface IdentificationView {
  can_claim: boolean
  can_release: boolean
  can_identify: boolean
  claimed_by_me: boolean
  claimed_by_other: boolean
  reviewer_nickname: string
}

interface CommentView {
  comment_id: string
  content: string
  time_text: string
  author_nickname: string
  author_avatar_url: string
  is_expert: boolean
  replies: CommentReplyView[]
}

interface CommentReplyView {
  comment_id: string
  content: string
  time_text: string
  author_nickname: string
  author_avatar_url: string
  is_expert: boolean
  reply_to_nickname: string
}

interface ReplyTargetView {
  comment_id: string
  author_nickname: string
}

interface AppealView {
  appeal_id: string
  status: string
  reason: string
  status_label: string
  time_text: string
}

function toCommentReplyView(item: ObservationCommentThreadItem['replies'][number]): CommentReplyView {
  return {
    comment_id: item.comment_id,
    content: item.content,
    time_text: item.time_text,
    author_nickname: item.author_nickname,
    author_avatar_url: item.author_avatar_url,
    is_expert: item.is_expert,
    reply_to_nickname: item.reply_to_nickname || '',
  }
}

function toCommentThreadView(item: ObservationCommentThreadItem): CommentView {
  return {
    comment_id: item.comment_id,
    content: item.content,
    time_text: item.time_text,
    author_nickname: item.author_nickname,
    author_avatar_url: item.author_avatar_url,
    is_expert: item.is_expert,
    replies: item.replies.map(toCommentReplyView),
  }
}

function toDetailView(item: ObservationDetailItem): DetailView {
  return {
    obs_id: item.obs_id,
    photo_url: item.photo_url,
    note: item.note || '暂无描述',
    location_name: item.location_name,
    location_detail: item.location_detail || '',
    species_name: item.species_name || '',
    species_remark: item.species_remark || '',
    species_label: item.species_label || formatSpeciesLabel(item.species_name, item.species_remark),
    status: item.status,
    status_label: item.status_label || '',
    time_text: item.time_text,
    time_full: item.time_full,
    like_count: item.like_count,
    comment_count: item.comment_count,
    liked: item.liked,
    publisher_nickname: item.publisher.nickname,
    publisher_avatar_url: item.publisher.avatar_url,
    is_rejected: item.status === 'rejected',
    is_featured: item.is_featured,
  }
}

function toIdentificationView(
  state: NonNullable<ReturnType<typeof getIdentificationState>>,
): IdentificationView {
  return {
    can_claim: state.can_claim,
    can_release: state.can_release,
    can_identify: state.can_identify,
    claimed_by_me: state.claimed_by_me,
    claimed_by_other: state.claimed_by_other,
    reviewer_nickname: state.reviewer_nickname || '',
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
    isOwner: false,
    commentsEnabled: true,
    isReviewer: false,
    isHidden: false,
    isFeatured: false,
    showIdentificationPanel: false,
    identification: null as IdentificationView | null,
    speciesCategories: SPECIES_CATEGORIES,
    speciesCategoryIndex: 0,
    speciesCategoryName: '',
    speciesRemarkInput: '',
    reviewNoteInput: '',
    identifying: false,
    claiming: false,
    replyTarget: null as ReplyTargetView | null,
    commentPlaceholder: '说点什么……',
    showAppealPanel: false,
    canSubmitAppeal: false,
    appeal: null as AppealView | null,
    appealInput: '',
    appealing: false,
  },

  onLoad(options: { id?: string }) {
    if (!getCurrentUser()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const obsId = options.id ? options.id.trim() : ''
    if (!obsId) {
      this.setData({ loading: false, unavailable: true })
      return
    }

    this.setData({ obsId })
    this.loadDetail(obsId)
  },

  loadDetail(obsId: string) {
    this.setData({ loading: true, unavailable: false })

    const user = getCurrentUser()
    getObservationDetail(obsId, user && user.user_id)
      .then(async (result) => {
        if (!result) {
          this.setData({ loading: false, unavailable: true, detail: null, comments: [] })
          return
        }

        const isReviewer = Boolean(user && canIdentifySpecies(user))
        const identificationState =
          isReviewer && user && result.status === 'needs_identification'
            ? await getIdentificationState(obsId, user.user_id)
            : null

        const isOwner = Boolean(user && result.publisher.user_id === user.user_id)
        const isRejected = result.status === 'rejected'
        const ownerAppeal =
          isOwner && isRejected && user
            ? await getOwnerAppealForObs(obsId, user.user_id)
            : null
        const canSubmitAppeal = Boolean(
          isOwner && isRejected && (!ownerAppeal || ownerAppeal.status === 'rejected'),
        )

        this.setData({
          loading: false,
          unavailable: false,
          detail: toDetailView(result),
          comments: result.comments.map(toCommentThreadView),
          isAdmin: Boolean(user && user.role === 'admin'),
          isOwner,
          commentsEnabled: result.comments_enabled,
          isReviewer,
          isHidden: result.status === 'rejected' || result.status === 'pending_review',
          isFeatured: result.is_featured,
          showIdentificationPanel: Boolean(identificationState),
          identification: identificationState ? toIdentificationView(identificationState) : null,
          speciesCategoryIndex: identificationState
            ? getSpeciesCategoryIndex(identificationState.species_name)
            : 0,
          speciesCategoryName: identificationState?.species_name || '',
          speciesRemarkInput: identificationState?.species_remark || '',
          reviewNoteInput: '',
          showAppealPanel: Boolean(isOwner && isRejected),
          canSubmitAppeal,
          appeal: ownerAppeal,
          appealInput: '',
        })
      })
      .catch((err) => {
        console.error('loadDetail error:', err)
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
        this.setData({ loading: false, unavailable: true, detail: null, comments: [] })
      })
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

    toggleObservationLike(this.data.obsId, user.user_id)
      .then((result) => {
        if (!result) {
          wx.showToast({ title: '操作失败', icon: 'none' })
          return
        }

        this.setData({
          'detail.liked': result.liked,
          'detail.like_count': result.like_count,
        })
      })
      .catch((err) => {
        console.error('toggleLike error:', err)
        wx.showToast({ title: '操作失败，请重试', icon: 'none' })
      })
      .finally(() => {
        this.setData({ liking: false })
      })
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ commentInput: e.detail.value })
  },

  onReplyComment(e: WechatMiniprogram.TouchEvent) {
    const commentId = e.currentTarget.dataset.id as string
    const nickname = e.currentTarget.dataset.nickname as string
    if (!commentId || !nickname) return

    this.setData({
      replyTarget: {
        comment_id: commentId,
        author_nickname: nickname,
      },
      commentPlaceholder: `回复 @${nickname}`,
    })
  },

  onCancelReply() {
    this.setData({
      replyTarget: null,
      commentPlaceholder: '说点什么……',
    })
  },

  onSubmitComment() {
    if (this.data.submitting || !this.data.detail) return
    if (!this.data.commentsEnabled) {
      wx.showToast({ title: '该记录的评论区已关闭，暂不支持评论', icon: 'none' })
      return
    }

    const user = getCurrentUser()
    if (!user) return

    const content = this.data.commentInput.trim()
    const validationError = validateCommentContent(content)
    if (validationError) {
      wx.showToast({ title: validationError, icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    const replyToCommentId = this.data.replyTarget ? this.data.replyTarget.comment_id : undefined

    createObservationComment(this.data.obsId, user.user_id, content, replyToCommentId)
      .then((result) => {
        if ('error' in result) {
          wx.showToast({ title: result.error, icon: 'none' })
          return
        }

        return listObservationCommentThreads(this.data.obsId).then((threads) => {
          this.setData({
            comments: threads.map(toCommentThreadView),
            commentInput: '',
            replyTarget: null,
            commentPlaceholder: '说点什么……',
            'detail.comment_count': result.comment_count,
          })
          wx.showToast({ title: '评论成功', icon: 'success' })
        })
      })
      .catch((err) => {
        console.error('submitComment error:', err)
        wx.showToast({ title: '发送失败，请重试', icon: 'none' })
      })
      .finally(() => {
        this.setData({ submitting: false })
      })
  },

  onToggleComments() {
    const user = getCurrentUser()
    const obsId = (this.data.obsId || '').trim()
    if (!user || !obsId || !this.data.isOwner) return

    const enabling = !this.data.commentsEnabled
    const title = enabling ? '开启评论区' : '关闭评论区'
    const content = enabling
      ? '开启后，其他用户可以在该记录下发表评论。'
      : '关闭后，其他用户将无法发表新评论，已有评论仍可查看。'

    wx.showModal({
      title,
      content,
      confirmColor: '#2d5a2e',
      success: (res) => {
        if (!res.confirm) return

        setObservationCommentsEnabled(obsId, user.user_id, enabling)
          .then((result) => {
            if (!result.success) {
              wx.showToast({ title: result.message || '操作失败', icon: 'none' })
              return
            }

            this.setData({
              commentsEnabled: result.comments_enabled !== false,
              replyTarget: null,
              commentPlaceholder: '说点什么……',
            })
            wx.showToast({ title: enabling ? '评论区已开启' : '评论区已关闭', icon: 'success' })
          })
          .catch((err) => {
            console.error('onToggleComments error:', err)
            wx.showToast({ title: '操作失败，请重试', icon: 'none' })
          })
      },
    })
  },

  onWithdrawObservation() {
    const user = getCurrentUser()
    const obsId = (this.data.obsId || '').trim()
    if (!user || !obsId) {
      wx.showToast({ title: '无法撤回，请返回重试', icon: 'none' })
      return
    }

    const userId = user.user_id

    wx.showModal({
      title: '撤回记录',
      content: '撤回后该记录将从平台移除，且无法恢复，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return

        withdrawObservation(obsId, userId)
          .then((result) => {
            if (!result.success) {
              wx.showToast({ title: result.message || '撤回失败', icon: 'none' })
              return
            }
            wx.showToast({ title: '已撤回', icon: 'success' })
            setTimeout(() => {
              wx.navigateBack({
                fail: () => {
                  wx.reLaunch({ url: '/pages/index/index' })
                },
              })
            }, 500)
          })
          .catch((err) => {
            console.error('onWithdrawObservation error:', err)
            wx.showToast({ title: '撤回失败，请重试', icon: 'none' })
          })
      },
    })
  },

  onHideObservation() {
    wx.showModal({
      title: '隐藏记录',
      content: '隐藏后该记录将不再出现在公开列表中，确定继续？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        hideObservationForAdmin(this.data.obsId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已隐藏', icon: 'success' })
          this.loadDetail(this.data.obsId)
        })
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
        restoreObservationForAdmin(this.data.obsId).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已恢复', icon: 'success' })
          this.loadDetail(this.data.obsId)
        })
      },
    })
  },

  onToggleFeatured() {
    const obsId = this.data.obsId.trim()
    const detail = this.data.detail
    if (!obsId || !detail) return

    const featured = !this.data.isFeatured
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

          this.setData({
            isFeatured: featured,
            detail: {
              ...detail,
              is_featured: featured,
            },
          })
          wx.showToast({ title: featured ? '已设为精选' : '已取消精选', icon: 'success' })
        })
      },
    })
  },

  onSpeciesCategoryChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value)
    const category = SPECIES_CATEGORIES[index]
    if (!category) return
    this.setData({
      speciesCategoryIndex: index,
      speciesCategoryName: category.name,
    })
  },

  onSpeciesRemarkInput(e: WechatMiniprogram.Input) {
    this.setData({ speciesRemarkInput: e.detail.value })
  },

  onReviewNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ reviewNoteInput: e.detail.value })
  },

  onClaimIdentification() {
    if (this.data.claiming) return

    const user = getCurrentUser()
    if (!user) return

    this.setData({ claiming: true })

    claimIdentification(this.data.obsId, user.user_id)
      .then((result) => {
        if (!result.success) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '认领成功', icon: 'success' })
        this.loadDetail(this.data.obsId)
      })
      .catch((err) => {
        console.error('onClaimIdentification error:', err)
        wx.showToast({ title: '认领失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ claiming: false })
      })
  },

  onReleaseIdentification() {
    const user = getCurrentUser()
    if (!user) return

    wx.showModal({
      title: '释放认领',
      content: '释放后其他审阅员可以认领该记录，确定继续？',
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return

        releaseIdentification(this.data.obsId, user.user_id)
          .then((result) => {
            if (!result.success) {
              wx.showToast({ title: result.message, icon: 'none' })
              return
            }
            wx.showToast({ title: '已释放', icon: 'success' })
            this.loadDetail(this.data.obsId)
          })
          .catch((err) => {
            console.error('onReleaseIdentification error:', err)
            wx.showToast({ title: '释放失败', icon: 'none' })
          })
      },
    })
  },

  onSubmitIdentification() {
    if (this.data.identifying) return

    const user = getCurrentUser()
    if (!user) return

    const categoryName = this.data.speciesCategoryName.trim()
    if (!categoryName) {
      wx.showToast({ title: '请选择物种类别', icon: 'none' })
      return
    }

    const obsId = this.data.obsId
    const speciesRemarkInput = this.data.speciesRemarkInput
    const reviewNoteInput = this.data.reviewNoteInput
    const displayLabel = formatSpeciesLabel(categoryName, speciesRemarkInput)

    wx.showModal({
      title: '提交鉴定',
      content: `确认将该记录鉴定为「${displayLabel}」？`,
      confirmColor: '#4c8c4a',
      success: (res) => {
        if (!res.confirm || this.data.identifying) return

        this.setData({ identifying: true })

        completeIdentification(
          obsId,
          user.user_id,
          categoryName,
          speciesRemarkInput,
          reviewNoteInput,
        )
          .then((result) => {
            if (!result.success) {
              wx.showToast({ title: result.message, icon: 'none' })
              return
            }
            wx.showToast({ title: '鉴定完成', icon: 'success' })
            this.loadDetail(obsId)
          })
          .catch((err) => {
            console.error('onSubmitIdentification error:', err)
            wx.showToast({ title: '提交失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ identifying: false })
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
          this.loadDetail(this.data.obsId)
        })
      },
    })
  },

  onAppealInput(e: WechatMiniprogram.Input) {
    this.setData({ appealInput: e.detail.value })
  },

  onSubmitAppeal() {
    if (this.data.appealing || !this.data.canSubmitAppeal) return

    const user = getCurrentUser()
    if (!user) return

    const reason = this.data.appealInput.trim()
    if (!reason) {
      wx.showToast({ title: '请填写申诉原因', icon: 'none' })
      return
    }

    this.setData({ appealing: true })

    submitObservationAppeal(this.data.obsId, user.user_id, reason)
      .then((result) => {
        if (!result.success) {
          wx.showToast({ title: result.message || '提交失败', icon: 'none' })
          return
        }

        wx.showToast({ title: '申诉已提交', icon: 'success' })
        this.loadDetail(this.data.obsId)
      })
      .catch((err) => {
        console.error('onSubmitAppeal error:', err)
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      })
      .finally(() => {
        this.setData({ appealing: false })
      })
  },
})
