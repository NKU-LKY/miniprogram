import type { ObservationCommentItem } from '../../../types/comment'
import { validateCommentContent } from '../../../utils/content-filter'
import { request } from './client'
import {
  notifyCommentLikeRemote,
  notifyCommentPostRemote,
  notifyCommentReplyRemote,
  notifyPostLikeRemote,
} from './notification'
import {
  checkPostLiked,
  getPostCommentCount,
  getPostIdByObsId,
  getPostLikeCount,
} from './post'
import { mapCommentTree, toRemoteUserId, toUserId } from './mappers'
import type { PaginatedResult, RemoteComment, RemotePost } from './types'

async function notifyCommentCreated(params: {
  obsId: string
  postId: string
  commenterUserId: string
  content: string
  saved: RemoteComment
}): Promise<void> {
  const fullPost = await request<RemotePost>(`/api/posts/${params.postId}`).catch(() => null)
  const obsId = fullPost?.observation?.obsId ?? params.obsId
  const ownerId = fullPost?.observation?.user?.userId

  if (params.saved.parentCommentId) {
    const parent = await request<RemoteComment>(`/api/comments/${params.saved.parentCommentId}`).catch(
      () => null,
    )
    const recipientId = parent?.user?.userId
    if (recipientId) {
      await notifyCommentReplyRemote({
        replyToUserId: recipientId,
        commenterUserId: params.commenterUserId,
        obsId,
        content: params.content,
      })
    }
    return
  }

  if (!ownerId) return

  await notifyCommentPostRemote({
    ownerUserId: ownerId,
    commenterUserId: params.commenterUserId,
    obsId,
    content: params.content,
  })
}

export async function toggleObservationLikeRemote(
  obsId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  const postId = await getPostIdByObsId(obsId)
  if (!postId) return null

  const fullPost = await request<RemotePost>(`/api/posts/${postId}`).catch(() => null)
  const liked = await checkPostLiked(postId, userId)
  const method = liked ? 'DELETE' : 'POST'

  const result = await request<{ liked: boolean; likeCount: number }>('/api/post-likes', {
    method,
    data: { postId: Number(postId), userId: toRemoteUserId(userId) },
  })

  if (method === 'POST' && result.liked && fullPost?.observation?.user?.userId) {
    void notifyPostLikeRemote({
      ownerUserId: fullPost.observation.user.userId,
      likerUserId: userId,
      obsId,
    }).catch((err) => console.warn('create post like notification failed:', err))
  }

  return { liked: result.liked, like_count: result.likeCount }
}

export async function toggleCommentLikeRemote(
  commentId: string,
  userId: string,
  obsId?: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  const trimmedId = commentId.trim()
  if (!trimmedId) return null

  const comment = await request<RemoteComment>(`/api/comments/${trimmedId}`).catch(() => null)
  if (!comment) return null

  const liked = await request<{ liked: boolean }>('/api/comment-likes/check', {
    query: { commentId: trimmedId, userId: toRemoteUserId(userId) },
  })
    .then((data) => data.liked)
    .catch(() => false)

  const method = liked ? 'DELETE' : 'POST'
  const result = await request<{ liked: boolean; likeCount: number }>('/api/comment-likes', {
    method,
    data: { commentId: Number(trimmedId), userId: toRemoteUserId(userId) },
  })

  if (method === 'POST' && result.liked && comment.user?.userId) {
    let resolvedObsId = obsId
    if (!resolvedObsId) {
      const post = await request<RemotePost>(`/api/posts/${comment.postId}`).catch(() => null)
      resolvedObsId = post?.observation?.obsId ? toUserId(post.observation.obsId) : undefined
    }

    if (resolvedObsId) {
      void notifyCommentLikeRemote({
        commentAuthorUserId: comment.user.userId,
        likerUserId: userId,
        obsId: resolvedObsId,
      }).catch((err) => console.warn('create comment like notification failed:', err))
    }
  }

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

    void notifyCommentCreated({
      obsId,
      postId,
      commenterUserId: userId,
      content: content.trim(),
      saved,
    }).catch((err) => console.warn('create comment notification failed:', err))

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
