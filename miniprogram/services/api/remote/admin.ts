import type { ModerationAppealItem } from '../../../types/appeal'
import { ROLE_LABELS, STATUS_LABELS, type AdminUserListItem, type UserRole } from '../../../types/user'
import type { ObservationStatus } from '../../../types/observation'
import { formatRelativeTime } from '../../../utils/time'
import { request } from './client'
import {
  getObservationPhotoUrl,
  mapObservationStatus,
  mapRemoteUser,
  toRemoteUserId,
  toUserId,
} from './mappers'
import { getPostByObsId } from './post'
import type { PaginatedResult, RemoteComment, RemotePost, RemoteUser } from './types'
import {
  approveAppealRemote,
  listAppealsForModerationRemote,
  rejectAppealRemote,
} from './appeal'

export interface ModerationObsItem {
  obs_id: string
  photo_url: string
  note: string
  publisher_nickname: string
  status: ObservationStatus
  status_label: string
  time_text: string
  is_hidden: boolean
  is_featured: boolean
  has_pending_appeal: boolean
}

export interface ModerationCommentItem {
  comment_id: string
  obs_id: string
  content: string
  author_nickname: string
  time_text: string
}

export interface AdminActionResult {
  success: boolean
  message?: string
}

const OBS_STATUS_LABELS: Partial<Record<ObservationStatus, string>> = {
  approved: '已发布',
  needs_identification: '待鉴定',
  identified: '已鉴定',
  rejected: '已隐藏',
  pending_review: '待审核',
  withdrawn: '已撤回',
}

function toAdminUserItem(user: RemoteUser, selfId: string): AdminUserListItem {
  const mapped = mapRemoteUser(user)
  return {
    user_id: mapped.user_id,
    nickname: mapped.nickname,
    avatar_url: mapped.avatar_url,
    username: mapped.username,
    role: mapped.role,
    role_label: ROLE_LABELS[mapped.role],
    status: mapped.status,
    status_label: STATUS_LABELS[mapped.status],
    last_login_text: formatRelativeTime(mapped.last_login_at),
    is_self: mapped.user_id === selfId,
  }
}

export async function listUsersForAdminRemote(adminId: string): Promise<AdminUserListItem[]> {
  const result = await request<PaginatedResult<RemoteUser>>('/api/users', {
    query: { page: 1, pageSize: 200 },
  })
  return result.list.map((user) => toAdminUserItem(user, adminId))
}

export async function setUserRoleForAdminRemote(
  targetUserId: string,
  role: UserRole,
): Promise<AdminActionResult> {
  try {
    await request(`/api/users/${targetUserId}/role`, {
      method: 'PATCH',
      data: { role },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '更新失败' }
  }
}

export async function setUserBanForAdminRemote(
  targetUserId: string,
  banned: boolean,
): Promise<AdminActionResult> {
  try {
    await request(`/api/users/${targetUserId}/status`, {
      method: 'PATCH',
      data: { status: banned ? 'banned' : 'active' },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '更新失败' }
  }
}

export async function listObservationsForModerationRemote(): Promise<ModerationObsItem[]> {
  const posts = await request<PaginatedResult<RemotePost>>('/api/posts', {
    query: { page: 1, pageSize: 200, sortBy: 'created_at', order: 'DESC' },
  })

  const appeals = await listAppealsForModerationRemote()
  const pendingAppealObsIds = new Set(appeals.map((a) => a.obs_id))

  return posts.list
    .filter((post) => post.observation)
    .map((post) => {
      const obs = post.observation!
      const status = mapObservationStatus(obs.status, post.status)
      return {
        obs_id: toUserId(obs.obsId),
        photo_url: getObservationPhotoUrl(obs),
        note: obs.content || '（无描述）',
        publisher_nickname: obs.user?.nickname || '未知用户',
        status,
        status_label: OBS_STATUS_LABELS[status] || status,
        time_text: formatRelativeTime(obs.submittedAt),
        is_hidden: status === 'rejected' || status === 'pending_review',
        is_featured: post.priority > 0,
        has_pending_appeal: pendingAppealObsIds.has(toUserId(obs.obsId)),
      }
    })
}

export async function listCommentsForModerationRemote(): Promise<ModerationCommentItem[]> {
  const posts = await request<PaginatedResult<RemotePost>>('/api/posts', {
    query: { page: 1, pageSize: 50, status: 'published' },
  })

  const comments: ModerationCommentItem[] = []

  for (const post of posts.list) {
    if (!post.observation) continue
    const obsId = toUserId(post.observation.obsId)
    const result = await request<PaginatedResult<RemoteComment>>(
      `/api/comments/by-post/${post.postId}`,
      { query: { page: 1, pageSize: 50, status: 'visible' } },
    ).catch(() => ({ list: [] as RemoteComment[], total: 0, page: 1, pageSize: 50 }))

    result.list.forEach((comment) => {
      comments.push({
        comment_id: toUserId(comment.commentId),
        obs_id: obsId,
        content: comment.content,
        author_nickname: comment.user?.nickname || '未知用户',
        time_text: formatRelativeTime(comment.createdAt),
      })
      ;(comment.children || []).forEach((child) => {
        comments.push({
          comment_id: toUserId(child.commentId),
          obs_id: obsId,
          content: child.content,
          author_nickname: child.user?.nickname || '未知用户',
          time_text: formatRelativeTime(child.createdAt),
        })
      })
    })
  }

  return comments.sort(
    (a, b) => new Date(b.time_text).getTime() - new Date(a.time_text).getTime(),
  )
}

export async function hideObservationForAdminRemote(obsId: string): Promise<AdminActionResult> {
  try {
    const post = await getPostByObsId(obsId)
    if (post) {
      await request(`/api/posts/${post.postId}`, {
        method: 'PUT',
        data: { status: 'banned' },
      })
    }
    await request(`/api/observations/${obsId}/status`, {
      method: 'PATCH',
      data: { status: 'rejected', userId: 1 },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}

export async function restoreObservationForAdminRemote(obsId: string): Promise<AdminActionResult> {
  try {
    const post = await getPostByObsId(obsId)
    if (post) {
      await request(`/api/posts/${post.postId}`, {
        method: 'PUT',
        data: { status: 'published' },
      })
    }
    await request(`/api/observations/${obsId}/status`, {
      method: 'PATCH',
      data: { status: 'approved', userId: 1 },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}

export async function setObservationFeaturedForAdminRemote(
  obsId: string,
  featured: boolean,
): Promise<AdminActionResult> {
  try {
    const post = await getPostByObsId(obsId)
    if (!post) return { success: false, message: '记录不存在' }

    await request(`/api/posts/${post.postId}`, {
      method: 'PUT',
      data: { priority: featured ? 1 : 0 },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}

export async function hideCommentForAdminRemote(commentId: string): Promise<AdminActionResult> {
  try {
    await request(`/api/comments/${commentId}`, {
      method: 'PUT',
      data: { status: 'banned' },
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '操作失败' }
  }
}
