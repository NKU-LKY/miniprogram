import type { ObservationComment } from '../../types/comment'
import { getLocalItem, setLocalItem } from './storage'

const COMMENTS_KEY = 'observation_comments'

function generateCommentId(): string {
  return `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getAllComments(): ObservationComment[] {
  const stored = getLocalItem<ObservationComment[]>(COMMENTS_KEY)
  return Array.isArray(stored) ? stored : []
}

export function getCommentsByObsId(obsId: string): ObservationComment[] {
  return getAllComments()
    .filter((item) => item.obs_id === obsId && item.status === 'active')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export function addObservationComment(
  obsId: string,
  userId: string,
  content: string,
  replyTo?: { comment_id: string; user_id: string; parent_comment_id?: string },
): ObservationComment {
  const comment: ObservationComment = {
    comment_id: generateCommentId(),
    obs_id: obsId,
    user_id: userId,
    content,
    created_at: new Date().toISOString(),
    status: 'active',
    reply_to_comment_id: replyTo ? replyTo.comment_id : undefined,
    reply_to_user_id: replyTo ? replyTo.user_id : undefined,
    parent_comment_id: replyTo ? replyTo.parent_comment_id : undefined,
  }

  const all = getAllComments()
  setLocalItem(COMMENTS_KEY, [...all, comment])
  return comment
}

export function findCommentById(commentId: string): ObservationComment | undefined {
  return getAllComments().find((item) => item.comment_id === commentId)
}

export function softDeleteComment(commentId: string): ObservationComment | null {
  const all = getAllComments()
  const index = all.findIndex((item) => item.comment_id === commentId)
  if (index < 0 || all[index].status === 'deleted') return null

  all[index] = { ...all[index], status: 'deleted' }
  setLocalItem(COMMENTS_KEY, all)
  return all[index]
}
