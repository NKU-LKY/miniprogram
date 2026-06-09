import type { ObservationFeedItem, ObservationStatus } from '../../types/observation'
import type { SpeciesArchiveSummary } from '../../types/species'
import { ROLE_LABELS } from '../../types/user'
import { buildObservationDiary, type ObservationDiary } from '../../utils/observation-diary'
import { buildSpeciesArchiveSummaries } from '../../utils/species-archive'
import { formatIdentifiedStatusLabel, formatSpeciesLabel } from '../../utils/species-display'
import { formatRelativeTime } from '../../utils/time'
import { isObservationFeatured } from './featured-store'
import { getAllObservations } from './observation-store'
import { findUserById } from './user-store'

const STATUS_LABELS: Partial<Record<ObservationStatus, string>> = {
  needs_identification: '待鉴定',
  identified: '已鉴定',
  rejected: '已驳回',
}

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export interface UserProfileStats {
  share_count: number
  total_likes: number
  species_count: number
}

export interface UserProfileData {
  user_id: string
  nickname: string
  avatar_url: string
  role_label: string
  stats: UserProfileStats
  records: ObservationFeedItem[]
  species_list: SpeciesArchiveSummary[]
  diary: ObservationDiary
}

function toFeedItem(obs: ReturnType<typeof getAllObservations>[number]): ObservationFeedItem {
  const user = findUserById(obs.user_id)
  const statusLabel = STATUS_LABELS[obs.status]
  let displayStatusLabel = statusLabel

  if (obs.status === 'identified') {
    displayStatusLabel = formatIdentifiedStatusLabel(obs.species_name, obs.species_remark)
  }

  const speciesLabel = formatSpeciesLabel(obs.species_name, obs.species_remark)

  return {
    obs_id: obs.obs_id,
    photo_url: obs.photo_url,
    note: obs.note,
    location_name: obs.location_name,
    species_name: obs.species_name,
    species_remark: obs.species_remark,
    species_label: speciesLabel || undefined,
    status: obs.status,
    status_label: displayStatusLabel,
    submitted_at: obs.submitted_at,
    time_text: formatRelativeTime(obs.submitted_at),
    like_count: obs.like_count,
    comment_count: obs.comment_count,
    is_featured: isObservationFeatured(obs.obs_id),
    publisher: {
      user_id: obs.user_id,
      nickname: (user && user.nickname) || '小林同学',
      avatar_url: (user && user.avatar_url) || DEFAULT_AVATAR,
    },
  }
}

export function getUserProfile(userId: string): UserProfileData | null {
  const user = findUserById(userId)
  if (!user) return null

  const { password_hash: _, ...safe } = user
  const myObservations = getAllObservations()
    .filter((obs) => obs.user_id === userId && obs.status !== 'withdrawn')
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())

  const archivable = myObservations.filter(
    (obs) =>
      (obs.species_name && obs.species_name.trim()) &&
      obs.status !== 'rejected' &&
      obs.status !== 'pending_review',
  )

  return {
    user_id: safe.user_id,
    nickname: safe.nickname || '未命名用户',
    avatar_url: safe.avatar_url || DEFAULT_AVATAR,
    role_label: ROLE_LABELS[safe.role] || '',
    stats: {
      share_count: myObservations.length,
      total_likes: myObservations.reduce((sum, obs) => sum + obs.like_count, 0),
      species_count: buildSpeciesArchiveSummaries(archivable).length,
    },
    records: myObservations.map(toFeedItem),
    species_list: buildSpeciesArchiveSummaries(archivable),
    diary: buildObservationDiary(myObservations.map((obs) => obs.submitted_at)),
  }
}
