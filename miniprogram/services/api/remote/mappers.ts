import { isValidSpeciesCategory, SPECIES_CATEGORY_NAMES } from '../../../data/species-categories'
import type { ObservationCommentThreadItem } from '../../../types/comment'
import type { NotificationItem, NotificationType } from '../../../types/notification'
import type {
  ObservationFeedItem,
  ObservationStatus,
} from '../../../types/observation'
import type { SafeUser } from '../../../types/user'
import { resolveSpeciesArchiveKey } from '../../../utils/species-migration'
import {
  formatIdentifiedStatusLabel,
  formatSpeciesLabel,
} from '../../../utils/species-display'
import { formatRelativeTime } from '../../../utils/time'
import type {
  RemoteComment,
  RemoteIdentificationRequest,
  RemoteLocation,
  RemoteNotification,
  RemoteObservation,
  RemotePost,
  RemoteSpecies,
  RemoteUser,
} from './types'
import { resolveMediaUrl } from './client'

const STATUS_LABELS: Partial<Record<ObservationStatus, string>> = {
  needs_identification: '待鉴定',
  identified: '已鉴定',
  rejected: '已驳回',
  pending_review: '待审核',
}

const NOTIFICATION_TYPE_META: Record<
  string,
  { type: NotificationType; label: string; icon: string; title: string }
> = {
  observation_approved: { type: 'identification_result', label: '审核通过', icon: '✅', title: '记录已通过' },
  observation_rejected: { type: 'observation_hidden', label: '记录隐藏', icon: '🚫', title: '记录已被隐藏' },
  identification_completed: { type: 'identification_result', label: '鉴定结果', icon: '🔬', title: '鉴定完成' },
  identification_requested: { type: 'identification_result', label: '鉴定请求', icon: '🔬', title: '鉴定请求' },
  comment_post: { type: 'comment', label: '新评论', icon: '💬', title: '收到新评论' },
  comment_reply: { type: 'comment_reply', label: '评论回复', icon: '↩️', title: '收到评论回复' },
  post_like: { type: 'comment', label: '帖子点赞', icon: '👍', title: '收到点赞' },
  comment_like: { type: 'comment', label: '评论点赞', icon: '👍', title: '评论被点赞' },
  system_notice: { type: 'observation_hidden', label: '系统通知', icon: '📢', title: '系统通知' },
  appeal_received: { type: 'appeal_received', label: '隐藏申诉', icon: '📋', title: '收到隐藏申诉' },
  appeal_approved: { type: 'appeal_approved', label: '申诉通过', icon: '✅', title: '申诉已通过' },
  appeal_rejected: { type: 'appeal_rejected', label: '申诉驳回', icon: '❌', title: '申诉已驳回' },
}

export function toUserId(id: number | string | null | undefined): string {
  if (id === null || id === undefined) return ''
  return String(id)
}

export function toRemoteUserId(userId: string): number {
  return Number(userId)
}

export function mapRemoteUser(user: RemoteUser): SafeUser {
  return {
    user_id: toUserId(user.userId),
    username: user.username || undefined,
    email: user.email || undefined,
    role: user.role,
    status: user.status,
    nickname: user.nickname || '未命名用户',
    avatar_url: resolveMediaUrl(user.avatarUrl, 'avatar'),
    created_at: user.createdAt,
    last_login_at: user.lastLoginAt || user.createdAt,
  }
}

/** 将后端地点 description 解析为前端地址备注 */
export function parseLocationDetail(location?: RemoteLocation | null): string | undefined {
  if (!location) return undefined
  const detail = (location.description || '').trim()
  if (!detail) return undefined
  const name = (location.name || '').trim()
  if (name && detail === name) return undefined
  return detail
}

/** 解析「备注@大类」复合物种名（大类固定，从右匹配） */
export function parseCompositeSpeciesName(
  speciesName: string,
): { category: string; remark: string } | null {
  const name = speciesName.trim()
  if (!name) return null

  for (const category of SPECIES_CATEGORY_NAMES) {
    const suffix = `@${category}`
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return {
        category,
        remark: name.slice(0, -suffix.length),
      }
    }
  }
  return null
}

/** 将后端物种解析为前端「大类 + 备注」 */
export function parseSpeciesFields(species: RemoteSpecies | null | undefined): {
  species_name?: string
  species_remark?: string
} {
  if (!species) return {}

  const desc = (species.description || '').trim()
  const name = (species.speciesName || '').trim()
  if (!name && !desc) return {}

  const composite = parseCompositeSpeciesName(name)
  if (composite) {
    return {
      species_name: composite.category,
      species_remark: composite.remark,
    }
  }

  if (desc && isValidSpeciesCategory(desc)) {
    return {
      species_name: desc,
      species_remark: name && name !== desc ? name : undefined,
    }
  }

  if (isValidSpeciesCategory(name)) {
    return { species_name: name }
  }

  const category = resolveSpeciesArchiveKey(name || desc)
  if (category) {
    const remark = name && name !== category ? name : desc && desc !== category ? desc : undefined
    return {
      species_name: category,
      species_remark: remark,
    }
  }

  if (name) {
    return { species_name: '其他', species_remark: name }
  }

  if (desc) {
    return { species_name: '其他', species_remark: desc }
  }

  return {}
}

/** 将前端物种类别/备注编码为后端 species 字段 */
export function encodeSpeciesPayload(
  category?: string,
  remark?: string,
): { speciesName: string; description?: string } {
  const cat = (category || '').trim()
  const rem = (remark || '').trim()

  if (cat && rem) {
    return { speciesName: `${rem}@${cat}`, description: cat }
  }
  if (cat) {
    return { speciesName: cat, description: cat }
  }
  if (rem) {
    return { speciesName: rem }
  }
  return { speciesName: '其他' }
}

export function mapObservationStatus(status: string, postStatus?: string): ObservationStatus {
  if (postStatus === 'deleted') return 'withdrawn'
  if (postStatus === 'banned') return 'rejected'
  // 申诉通过后帖子已恢复公开，但观测 status 可能仍为 rejected
  if (postStatus === 'published' && status === 'rejected') return 'approved'
  if (status === 'pending_review') return 'pending_review'
  if (status === 'needs_identification') return 'needs_identification'
  if (status === 'identified') return 'identified'
  if (status === 'rejected') return 'rejected'
  return 'approved'
}

export function getObservationPhotoUrl(obs: RemoteObservation): string {
  const photo = obs.photos && obs.photos[0]
  if (!photo) return resolveMediaUrl(null, 'photo')
  return resolveMediaUrl(photo.previewPath || photo.filePath, 'photo')
}

export function toFeedItem(
  post: RemotePost,
  likeCount = 0,
  commentCount = 0,
): ObservationFeedItem | null {
  const obs = post.observation
  if (!obs) return null

  const speciesFields = parseSpeciesFields(obs.species)
  const status = mapObservationStatus(obs.status, post.status)
  let statusLabel = STATUS_LABELS[status]

  if (status === 'identified') {
    statusLabel = formatIdentifiedStatusLabel(speciesFields.species_name, speciesFields.species_remark)
  }

  const speciesLabel = formatSpeciesLabel(speciesFields.species_name, speciesFields.species_remark)

  return {
    obs_id: toUserId(obs.obsId),
    photo_url: getObservationPhotoUrl(obs),
    note: obs.content || '',
    location_name: obs.location?.name || '',
    location_detail: parseLocationDetail(obs.location),
    species_name: speciesFields.species_name,
    species_remark: speciesFields.species_remark,
    species_label: speciesLabel || undefined,
    status,
    status_label: statusLabel,
    submitted_at: obs.submittedAt,
    time_text: formatRelativeTime(obs.submittedAt),
    like_count: likeCount,
    comment_count: commentCount,
    is_featured: post.priority > 0,
    publisher: {
      user_id: toUserId(obs.user?.userId),
      nickname: obs.user?.nickname || '未命名用户',
      avatar_url: resolveMediaUrl(obs.user?.avatarUrl, 'avatar'),
    },
  }
}

function mapCommentUser(user: RemoteUser) {
  return {
    author_nickname: user.nickname || '未命名用户',
    author_avatar_url: resolveMediaUrl(user.avatarUrl, 'avatar'),
    is_expert: user.role === 'reviewer',
  }
}

function mapCommentNode(comment: RemoteComment, parentAuthor?: string): ObservationCommentThreadItem {
  const base = {
    comment_id: toUserId(comment.commentId),
    content: comment.content,
    time_text: formatRelativeTime(comment.createdAt),
    ...mapCommentUser(comment.user),
    reply_to_nickname: parentAuthor,
  }

  const replies = (comment.children || [])
    .filter((item) => item.status === 'visible')
    .map((item) => ({
      comment_id: toUserId(item.commentId),
      content: item.content,
      time_text: formatRelativeTime(item.createdAt),
      ...mapCommentUser(item.user),
      is_expert: item.user.role === 'reviewer',
      reply_to_nickname: comment.user.nickname || '未命名用户',
    }))

  return { ...base, replies }
}

export function mapCommentTree(comments: RemoteComment[]): ObservationCommentThreadItem[] {
  return comments
    .filter((item) => item.status === 'visible')
    .map((item) => mapCommentNode(item))
}

export function mapIdentificationQueueItem(
  req: RemoteIdentificationRequest,
  currentReviewerId: string,
) {
  const obs = req.observation
  const speciesFields = parseSpeciesFields(obs.species)
  const reviewerId = req.reviewer ? toUserId(req.reviewer.userId) : undefined
  const isClaimedByMe = Boolean(reviewerId && reviewerId === currentReviewerId)
  const isClaimedByOther = Boolean(reviewerId && reviewerId !== currentReviewerId)

  return {
    obs_id: toUserId(obs.obsId),
    photo_url: getObservationPhotoUrl(obs),
    note: obs.content || '',
    location_name: obs.location?.name || '',
    species_name: speciesFields.species_name,
    species_remark: speciesFields.species_remark,
    species_label: formatSpeciesLabel(speciesFields.species_name, speciesFields.species_remark) || undefined,
    submitted_at: obs.submittedAt,
    time_text: formatRelativeTime(obs.submittedAt),
    publisher_nickname: obs.user?.nickname || '未命名用户',
    publisher_avatar_url: resolveMediaUrl(obs.user?.avatarUrl, 'avatar'),
    reviewer_id: reviewerId,
    reviewer_nickname: req.reviewer?.nickname || undefined,
    claimed_at: undefined,
    claimed_time_text: undefined,
    is_claimed_by_me: isClaimedByMe,
    is_claimed_by_other: isClaimedByOther,
  }
}

export function mapNotificationItem(notification: RemoteNotification): NotificationItem {
  const content = notification.content || ''
  const type = notification.type || ''
  const isAdminAppealNotice =
    type === 'appeal_received' ||
    (type === 'system_notice' &&
      (content.startsWith('收到隐藏申诉') || content.startsWith('收到申诉')))
  const isAppealApprovedNotice = type === 'system_notice' && content.startsWith('你的申诉已通过')
  const isAppealRejectedNotice = type === 'system_notice' && content.startsWith('你的申诉未通过')

  const meta = isAdminAppealNotice
    ? NOTIFICATION_TYPE_META.appeal_received
    : isAppealApprovedNotice
      ? NOTIFICATION_TYPE_META.appeal_approved
      : isAppealRejectedNotice
        ? NOTIFICATION_TYPE_META.appeal_rejected
        : NOTIFICATION_TYPE_META[type] || {
            type: 'comment' as NotificationType,
            label: '通知',
            icon: '🔔',
            title: '通知',
          }

  let obsId: string | undefined
  if (
    type.includes('observation') ||
    type.includes('identification') ||
    type === 'post_like' ||
    type === 'comment_post' ||
    type === 'comment_reply' ||
    type === 'comment_like' ||
    type === 'appeal_approved' ||
    type === 'appeal_rejected' ||
    isAppealApprovedNotice ||
    isAppealRejectedNotice
  ) {
    obsId = notification.targetId ? toUserId(notification.targetId) : undefined
  }

  return {
    notification_id: toUserId(notification.notificationId),
    type: meta.type,
    type_label: meta.label,
    type_icon: meta.icon,
    title: meta.title,
    content: notification.content || '',
    obs_id: obsId,
    comment_id: undefined,
    is_read: notification.isRead,
    time_text: formatRelativeTime(notification.createdAt),
  }
}

export function observationToRemoteObservation(obs: RemoteObservation): RemoteObservation {
  return obs
}
