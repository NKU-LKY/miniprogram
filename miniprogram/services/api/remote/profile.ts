import type { ObservationFeedItem } from '../../../types/observation'
import type { SpeciesArchiveSummary } from '../../../types/species'
import type { SafeUser } from '../../../types/user'
import { ROLE_LABELS } from '../../../types/user'
import { buildObservationDiary, type ObservationDiary } from '../../../utils/observation-diary'
import { buildSpeciesArchiveSummaries } from '../../../utils/species-archive'
import { formatIdentifiedStatusLabel, formatSpeciesLabel } from '../../../utils/species-display'
import { formatRelativeTime } from '../../../utils/time'
import { request } from './client'
import { mapObservationStatus, toFeedItem, toUserId } from './mappers'
import {
  getPostByObsId,
  getPostCommentCount,
  getPostLikeCount,
  hydratePostObservation,
} from './post'
import type { PaginatedResult, RemoteObservation, RemotePost } from './types'

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

const EMPTY_DIARY = buildObservationDiary([])

async function listProfileFeedRemote(userId: string): Promise<ObservationFeedItem[]> {
  try {
    const result = await request<PaginatedResult<RemoteObservation>>(`/api/observations/user/${userId}`, {
      query: { page: 1, pageSize: 200 },
    })

    const entries = await Promise.all(
      (result?.list ?? []).map(async (obs) => {
        const post = await getPostByObsId(String(obs.obsId)).catch(() => null)
        return { obs, post }
      }),
    )

    const items: ObservationFeedItem[] = []
    for (const { obs, post } of entries) {
      if (mapObservationStatus(obs.status, post?.status) === 'withdrawn') continue

      const feedPost: RemotePost =
        post ||
        ({
          postId: 0,
          observation: obs,
          viewCount: 0,
          priority: 0,
          status: 'published',
          allowComment: true,
          createdAt: obs.submittedAt,
          updatedAt: obs.submittedAt,
        } as RemotePost)

      const postId = post ? String(post.postId) : null
      const [likeCount, commentCount, resolvedPost] = await Promise.all([
        postId ? getPostLikeCount(postId).catch(() => 0) : Promise.resolve(0),
        postId ? getPostCommentCount(postId).catch(() => 0) : Promise.resolve(0),
        hydratePostObservation(feedPost),
      ])

      const item = toFeedItem(resolvedPost, likeCount, commentCount)
      if (item) items.push(item)
    }

    return items.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  } catch (err) {
    console.warn('listProfileFeedRemote failed:', err)
    return []
  }
}

function toArchiveInput(item: ObservationFeedItem, fallbackUserId: string) {
  return {
    obs_id: item.obs_id,
    user_id: item.publisher?.user_id || fallbackUserId,
    species_name: item.species_name,
    species_remark: item.species_remark,
    location_name: item.location_name,
    note: item.note,
    status: item.status,
    submitted_at: item.submitted_at,
    photo_url: item.photo_url,
    like_count: item.like_count,
    comment_count: item.comment_count,
  }
}

function buildProfileFromUser(user: SafeUser, feedList: ObservationFeedItem[]): UserProfileData {
  const archivable = feedList.filter(
    (obs) =>
      obs.species_name &&
      obs.status !== 'rejected' &&
      obs.status !== 'pending_review',
  )

  let diary = EMPTY_DIARY
  try {
    diary = buildObservationDiary(feedList.map((item) => item.submitted_at))
  } catch (err) {
    console.warn('buildObservationDiary failed:', err)
  }

  let speciesList: SpeciesArchiveSummary[] = []
  try {
    speciesList = buildSpeciesArchiveSummaries(archivable.map((item) => toArchiveInput(item, user.user_id)))
  } catch (err) {
    console.warn('buildSpeciesArchiveSummaries failed:', err)
  }

  return {
    user_id: user.user_id,
    nickname: user.nickname || '未命名用户',
    avatar_url: user.avatar_url,
    role_label: ROLE_LABELS[user.role] || '',
    stats: {
      share_count: feedList.length,
      total_likes: feedList.reduce((sum, obs) => sum + obs.like_count, 0),
      species_count: speciesList.length,
    },
    records: feedList.map((item) => ({
      ...item,
      status_label:
        item.status === 'identified'
          ? formatIdentifiedStatusLabel(item.species_name, item.species_remark)
          : item.status_label,
      species_label: item.species_label || formatSpeciesLabel(item.species_name, item.species_remark),
      time_text: formatRelativeTime(item.submitted_at),
    })),
    species_list: speciesList,
    diary,
  }
}

export async function getUserProfileRemote(
  userId: string,
  sessionUser: SafeUser,
): Promise<UserProfileData> {
  if (!sessionUser || toUserId(sessionUser.user_id) !== toUserId(userId)) {
    throw new Error('会话无效，请重新登录')
  }

  try {
    const feedList = await listProfileFeedRemote(userId)
    return buildProfileFromUser(sessionUser, feedList)
  } catch (err) {
    console.warn('getUserProfileRemote failed, fallback to session only:', err)
    return buildProfileFromUser(sessionUser, [])
  }
}
