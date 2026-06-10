import type { ObservationCommentItem } from '../../../types/comment'
import { validateCommentContent } from '../../../utils/content-filter'
import { request } from './client'
import {
  checkPostLiked,
  getPostCommentCount,
  getPostIdByObsId,
  getPostLikeCount,
} from './post'
import { mapCommentTree, toRemoteUserId, toUserId } from './mappers'
import type { PaginatedResult, RemoteComment } from './types'

export async function toggleObservationLikeRemote(
  obsId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  const postId = await getPostIdByObsId(obsId)
  if (!postId) return null

  const liked = await checkPostLiked(postId, userId)
  const method = liked ? 'DELETE' : 'POST'

  const result = await request<{ liked: boolean; likeCount: number }>('/api/post-likes', {
    method,
    data: { postId: Number(postId), userId: toRemoteUserId(userId) },
  })

  return { liked: result.liked, like_count: result.likeCount }
}

export async function createObservationCommentRemote(
  obsId: string,
  userId: string,
  content: string,
  replyToCommentId?: string,
): Promise<{ comment: ObservationCommentItem; comment_count: number } | { error: string }> {
  const validationError = validateCommentContent(content)
  if (validationError) return { error: validationError }

  const postId = await getPostIdByObsId(obsId)
  if (!postId) return { error: '记录不存在' }

  const post = await request<{ allowComment: boolean }>(`/api/posts/${postId}`).catch(() => null)
  if (post && post.allowComment === false) {
    return { error: '该记录的评论区已关闭，暂不支持评论' }
  }

  try {
    const saved = await request<RemoteComment>('/api/comments', {
      method: 'POST',
      data: {
        postId: Number(postId),
        userId: toRemoteUserId(userId),
        parentCommentId: replyToCommentId ? Number(replyToCommentId) : null,
        content: content.trim(),
      },
    })

    const commentCount = await getPostCommentCount(postId)
    const thread = mapCommentTree([{ ...saved, children: [] }])[0]

    return {
      comment: thread,
      comment_count: commentCount,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '评论失败' }
  }
}

export async function listObservationCommentThreadsRemote(obsId: string) {
  const postId = await getPostIdByObsId(obsId)
  if (!postId) return []

  const result = await request<PaginatedResult<RemoteComment>>(`/api/comments/by-post/${postId}`, {
    query: { page: 1, pageSize: 50, status: 'visible' },
  })

  return mapCommentTree(result.list)
}

export async function isObservationLikedRemote(obsId: string, userId?: string): Promise<boolean> {
  if (!userId) return false
  const postId = await getPostIdByObsId(obsId)
  if (!postId) return false
  return checkPostLiked(postId, userId)
}

export async function getObservationLikeCountRemote(obsId: string): Promise<number> {
  const postId = await getPostIdByObsId(obsId)
  if (!postId) return 0
  return getPostLikeCount(postId)
}
