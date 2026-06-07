import type { ObservationCommentItem } from '../../types/comment'
import { validateCommentContent } from '../../utils/content-filter'
import { formatRelativeTime } from '../../utils/time'
import { addObservationComment, findCommentById, getCommentsByObsId } from './comment-store'
import { hasUserLiked, toggleUserLike } from './like-store'
import {
  notifyCommentReply,
  notifyObservationComment,
} from './notification-api'
import { getAllObservations, updateObservation } from './observation-store'
import { findUserById } from './user-store'

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

function toCommentItem(comment: ReturnType<typeof getCommentsByObsId>[number]): ObservationCommentItem {
  const user = findUserById(comment.user_id)
  const replyTarget = comment.reply_to_user_id ? findUserById(comment.reply_to_user_id) : undefined
  return {
    comment_id: comment.comment_id,
    content: comment.content,
    time_text: formatRelativeTime(comment.created_at),
    author_nickname: (user && user.nickname) || '小林同学',
    author_avatar_url: (user && user.avatar_url) || DEFAULT_AVATAR,
    is_expert: Boolean(user && user.role === 'reviewer'),
    reply_to_nickname: replyTarget ? replyTarget.nickname : undefined,
  }
}

export function listObservationComments(obsId: string): ObservationCommentItem[] {
  return getCommentsByObsId(obsId).map(toCommentItem)
}

export function isObservationLiked(obsId: string, userId?: string): boolean {
  if (!userId) return false
  return hasUserLiked(obsId, userId)
}

export function toggleObservationLike(
  obsId: string,
  userId: string,
): { liked: boolean; like_count: number } | null {
  const obs = getAllObservations().find((item) => item.obs_id === obsId)
  if (!obs) return null

  const liked = toggleUserLike(obsId, userId)
  const delta = liked ? 1 : -1
  const like_count = Math.max(0, obs.like_count + delta)
  updateObservation(obsId, { like_count })

  return { liked, like_count }
}

export function createObservationComment(
  obsId: string,
  userId: string,
  content: string,
  replyToCommentId?: string,
): { comment: ObservationCommentItem; comment_count: number } | { error: string } {
  const validationError = validateCommentContent(content)
  if (validationError) return { error: validationError }

  const obs = getAllObservations().find((item) => item.obs_id === obsId)
  if (!obs) return { error: '记录不存在' }

  let replyTo: { comment_id: string; user_id: string } | undefined
  if (replyToCommentId) {
    const target = findCommentById(replyToCommentId.trim())
    if (!target || target.obs_id !== obsId || target.status !== 'active') {
      return { error: '回复的评论不存在' }
    }
    replyTo = { comment_id: target.comment_id, user_id: target.user_id }
  }

  const saved = addObservationComment(obsId, userId, content.trim(), replyTo)
  const comment_count = obs.comment_count + 1
  updateObservation(obsId, { comment_count })

  try {
    if (replyTo) {
      notifyCommentReply({
        replyToUserId: replyTo.user_id,
        commenterUserId: userId,
        obsId,
        commentId: saved.comment_id,
        commentPreview: saved.content,
      })
    } else {
      notifyObservationComment({
        ownerUserId: obs.user_id,
        commenterUserId: userId,
        obsId,
        commentId: saved.comment_id,
        commentPreview: saved.content,
      })
    }
  } catch (err) {
    console.error('createObservationComment notify error:', err)
  }

  return {
    comment: toCommentItem(saved),
    comment_count,
  }
}
