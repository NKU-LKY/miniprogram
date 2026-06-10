import type { ObservationFeedItem } from '../../../types/observation'
import type { SpeciesArchiveSummary } from '../../../types/species'
import { ROLE_LABELS } from '../../../types/user'
import { buildObservationDiary, type ObservationDiary } from '../../../utils/observation-diary'
import { buildSpeciesArchiveSummaries } from '../../../utils/species-archive'
import { formatIdentifiedStatusLabel, formatSpeciesLabel } from '../../../utils/species-display'
import { formatRelativeTime } from '../../../utils/time'
import { fetchUserById } from './auth'
import { listMyFeedRemote } from './observation'

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

export async function getUserProfileRemote(userId: string): Promise<UserProfileData | null> {
  const user = await fetchUserById(userId)
  if (!user) return null

  const feed = await listMyFeedRemote(userId, 1, 200)
  const archivable = feed.list.filter(
    (obs) =>
      obs.species_name &&
      obs.status !== 'rejected' &&
      obs.status !== 'pending_review',
  )

  return {
    user_id: user.user_id,
    nickname: user.nickname || '未命名用户',
    avatar_url: user.avatar_url,
    role_label: ROLE_LABELS[user.role] || '',
    stats: {
      share_count: feed.total,
      total_likes: feed.list.reduce((sum, obs) => sum + obs.like_count, 0),
      species_count: buildSpeciesArchiveSummaries(
        archivable.map((item) => ({
          obs_id: item.obs_id,
          user_id: item.publisher.user_id,
          species_name: item.species_name,
          species_remark: item.species_remark,
          location_name: item.location_name,
          note: item.note,
          status: item.status,
          submitted_at: item.submitted_at,
          photo_url: item.photo_url,
          like_count: item.like_count,
          comment_count: item.comment_count,
        })),
      ).length,
    },
    records: feed.list.map((item) => ({
      ...item,
      status_label:
        item.status === 'identified'
          ? formatIdentifiedStatusLabel(item.species_name, item.species_remark)
          : item.status_label,
      species_label: item.species_label || formatSpeciesLabel(item.species_name, item.species_remark),
      time_text: formatRelativeTime(item.submitted_at),
    })),
    species_list: buildSpeciesArchiveSummaries(
      archivable.map((item) => ({
        obs_id: item.obs_id,
        user_id: item.publisher.user_id,
        species_name: item.species_name,
        species_remark: item.species_remark,
        location_name: item.location_name,
        note: item.note,
        status: item.status,
        submitted_at: item.submitted_at,
        photo_url: item.photo_url,
        like_count: item.like_count,
        comment_count: item.comment_count,
      })),
    ),
    diary: buildObservationDiary(feed.list.map((item) => item.submitted_at)),
  }
}
