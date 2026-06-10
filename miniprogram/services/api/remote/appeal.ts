import type { OwnerAppealView } from '../../../types/appeal'
import { formatRelativeTime } from '../../../utils/time'
import { request } from './client'
import {
  notifyAdminsAppealReceivedRemote,
  notifyAppealApprovedRemote,
  notifyAppealRejectedRemote,
} from './notification'
import { getPostByObsId } from './post'
import { getObservationPhotoUrl, toRemoteUserId, toUserId } from './mappers'
import type { PaginatedResult, RemoteAppeal, RemotePost } from './types'

export interface SubmitAppealResult {
  success: boolean
  message?: string
}

const APPEAL_STATUS_LABELS = {
  pending: '申诉处理中',
  approved: '申诉已通过',
  rejected: '申诉已驳回',
} as const

function toOwnerAppealView(appeal: RemoteAppeal): OwnerAppealView {
  return {
    appeal_id: toUserId(appeal.appealId),
    status: appeal.status,
    reason: appeal.reason,
    status_label: APPEAL_STATUS_LABELS[appeal.status],
    time_text: formatRelativeTime(appeal.createdAt),
  }
}

export async function getOwnerAppealForObsRemote(
  obsId: string,
  userId: string,
): Promise<OwnerAppealView | null> {
  let post = await getPostByObsId(obsId, 'banned')
  if (!post) {
    post = await getPostByObsId(obsId)
  }
  if (!post) return null

  const obs = post.observation
  if (!obs || toUserId(obs.user?.userId) !== userId) return null
  if (obs.status !== 'rejected') return null

  const result = await request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
    query: { page: 1, pageSize: 10, userId: toRemoteUserId(userId), postId: post.postId },
  })

  const pending = result.list.find((item) => item.status === 'pending')
  if (pending) return toOwnerAppealView(pending)

  const rejected = result.list.find((item) => item.status === 'rejected')
  if (rejected) return toOwnerAppealView(rejected)

  return null
}

export async function submitObservationAppealRemote(
  obsId: string,
  userId: string,
  reason: string,
): Promise<SubmitAppealResult> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) return { success: false, message: '请填写申诉原因' }
  if (trimmedReason.length > 500) return { success: false, message: '申诉原因不能超过 500 字' }

  let post = await getPostByObsId(obsId, 'banned')
  if (!post) {
    post = await getPostByObsId(obsId)
  }
  if (!post) return { success: false, message: '该记录当前不可申诉' }

  const obs = post.observation
  if (!obs || toUserId(obs.user?.userId) !== userId) {
    return { success: false, message: '只能申诉自己的记录' }
  }
  if (obs.status !== 'rejected') {
    return { success: false, message: '该记录当前不可申诉' }
  }

  try {
    const appeal = await request<RemoteAppeal>('/api/appeals', {
      method: 'POST',
      data: {
        postId: post.postId,
        userId: toRemoteUserId(userId),
        reason: trimmedReason,
      },
    })

    try {
      await notifyAdminsAppealReceivedRemote({
        appellantUserId: userId,
        obsId,
        appealId: appeal.appealId,
        reason: trimmedReason,
      })
    } catch (err) {
      console.warn('notifyAdminsAppealReceivedRemote failed:', err)
    }

    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '提交失败' }
  }
}

export async function listAppealsForModerationRemote() {
  const result = await request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
    query: { page: 1, pageSize: 100, status: 'pending' },
  })

  const appeals = result?.list || []

  return Promise.all(
    appeals.map(async (appeal) => {
      let photo_url = ''
      let obs_note = appeal.reason
      let obs_id = ''

      try {
        const post = await request<RemotePost>(`/api/posts/${appeal.postId}`)
        if (post?.observation) {
          obs_id = toUserId(post.observation.obsId)
          photo_url = getObservationPhotoUrl(post.observation)
          obs_note = post.observation.content || obs_note
        }
      } catch {
        // ignore missing post
      }

      return {
        appeal_id: toUserId(appeal.appealId),
        obs_id,
        appellant_user_id: toUserId(appeal.user?.userId),
        photo_url,
        obs_note: obs_note || '（无描述）',
        reason: appeal.reason,
        appellant_nickname: appeal.user?.nickname || '未知用户',
        time_text: formatRelativeTime(appeal.createdAt),
      }
    }),
  )
}

async function notifyAppealResultRemote(params: {
  appealId: string
  reviewerId: string
  approved: boolean
  ownerUserId?: string | number
  obsId?: string | number
}): Promise<void> {
  let ownerUserId = params.ownerUserId ? toUserId(params.ownerUserId) : ''
  let obsId = params.obsId ? toUserId(params.obsId) : ''

  const appeal = await request<RemoteAppeal>(`/api/appeals/${params.appealId}`).catch(() => null)
  if (appeal) {
    if (!ownerUserId) ownerUserId = toUserId(appeal.user?.userId)
    if (!obsId && appeal.postId) {
      const post = await request<RemotePost>(`/api/posts/${appeal.postId}`).catch(() => null)
      obsId = toUserId(post?.observation?.obsId)
    }
  }

  if (!ownerUserId || !obsId) {
    console.warn('notifyAppealResultRemote: missing owner or obsId', params)
    return
  }

  const notify = params.approved ? notifyAppealApprovedRemote : notifyAppealRejectedRemote
  await notify({
    ownerUserId,
    adminUserId: params.reviewerId,
    obsId,
  })
}

export async function approveAppealRemote(
  appealId: string,
  reviewerId: string,
  context?: { ownerUserId?: string; obsId?: string },
) {
  try {
    const appeal = await request<RemoteAppeal>(`/api/appeals/${appealId}/review`, {
      method: 'PUT',
      data: {
        status: 'approved',
        reviewerId: toRemoteUserId(reviewerId),
      },
    })

    const obsId = context?.obsId || ''
    const post = await request<RemotePost>(`/api/posts/${appeal.postId}`).catch(() => null)
    const resolvedObsId = obsId || toUserId(post?.observation?.obsId)
    if (resolvedObsId && post) {
      if (post.status !== 'published') {
        await request(`/api/posts/${appeal.postId}`, {
          method: 'PUT',
          data: { status: 'published' },
        })
      }
      if (post.observation?.status === 'rejected') {
        await request(`/api/observations/${resolvedObsId}/status`, {
          method: 'PATCH',
          data: { status: 'approved', userId: toRemoteUserId(reviewerId) },
        })
      }
    }

    await notifyAppealResultRemote({
      appealId,
      reviewerId,
      approved: true,
      ownerUserId: context?.ownerUserId,
      obsId: resolvedObsId,
    })

    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}

export async function rejectAppealRemote(
  appealId: string,
  reviewerId: string,
  context?: { ownerUserId?: string; obsId?: string },
) {
  try {
    await request<RemoteAppeal>(`/api/appeals/${appealId}/review`, {
      method: 'PUT',
      data: {
        status: 'rejected',
        reviewerId: toRemoteUserId(reviewerId),
      },
    })

    await notifyAppealResultRemote({
      appealId,
      reviewerId,
      approved: false,
      ownerUserId: context?.ownerUserId,
      obsId: context?.obsId,
    })

    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}
