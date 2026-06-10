import type { OwnerAppealView } from '../../../types/appeal'
import { formatRelativeTime } from '../../../utils/time'
import { request } from './client'
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
  const post = await getPostByObsId(obsId, 'banned')
  if (!post) return null

  const obs = post.observation
  if (!obs || toUserId(obs.user?.userId) !== userId) return null

  const result = await request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
    query: { page: 1, pageSize: 10, userId: toRemoteUserId(userId), postId: post.postId },
  })

  const pending = result.list.find((item) => item.status === 'pending')
  if (pending) return toOwnerAppealView(pending)

  const latest = result.list[0]
  return latest ? toOwnerAppealView(latest) : null
}

export async function submitObservationAppealRemote(
  obsId: string,
  userId: string,
  reason: string,
): Promise<SubmitAppealResult> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) return { success: false, message: '请填写申诉原因' }
  if (trimmedReason.length > 500) return { success: false, message: '申诉原因不能超过 500 字' }

  const post = await getPostByObsId(obsId, 'banned')
  if (!post) return { success: false, message: '该记录当前不可申诉' }

  const obs = post.observation
  if (!obs || toUserId(obs.user?.userId) !== userId) {
    return { success: false, message: '只能申诉自己的记录' }
  }

  try {
    await request<RemoteAppeal>('/api/appeals', {
      method: 'POST',
      data: {
        postId: post.postId,
        userId: toRemoteUserId(userId),
        reason: trimmedReason,
      },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '提交失败' }
  }
}

export async function listAppealsForModerationRemote() {
  const result = await request<PaginatedResult<RemoteAppeal>>('/api/appeals', {
    query: { page: 1, pageSize: 100, status: 'pending' },
  })

  const items = []
  for (const appeal of result.list) {
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

    items.push({
      appeal_id: toUserId(appeal.appealId),
      obs_id,
      photo_url,
      obs_note: obs_note || '（无描述）',
      reason: appeal.reason,
      appellant_nickname: appeal.user?.nickname || '未知用户',
      time_text: formatRelativeTime(appeal.createdAt),
    })
  }

  return items
}

export async function approveAppealRemote(appealId: string, reviewerId: string) {
  await request<RemoteAppeal>(`/api/appeals/${appealId}/review`, {
    method: 'PUT',
    data: {
      status: 'approved',
      reviewerId: toRemoteUserId(reviewerId),
    },
  })
  return { success: true }
}

export async function rejectAppealRemote(appealId: string, reviewerId: string) {
  await request<RemoteAppeal>(`/api/appeals/${appealId}/review`, {
    method: 'PUT',
    data: {
      status: 'rejected',
      reviewerId: toRemoteUserId(reviewerId),
    },
  })
  return { success: true }
}
