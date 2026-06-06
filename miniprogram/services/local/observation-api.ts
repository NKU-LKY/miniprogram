import { SEED_OBSERVATIONS } from '../../data/observations.seed'
import type {
  CreateObservationParams,
  FeedListResult,
  Observation,
  ObservationFeedItem,
  ObservationStatus,
} from '../../types/observation'
import { formatRelativeTime } from '../../utils/time'
import { addObservation, buildSeedObservations, getAllObservations } from './observation-store'
import { findUserById } from './user-store'

const STATUS_LABELS: Partial<Record<ObservationStatus, string>> = {
  needs_identification: '待鉴定',
  identified: '已鉴定',
  rejected: '已驳回',
}

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

function toFeedItem(obs: Observation): ObservationFeedItem {
  const user = findUserById(obs.user_id)
  const statusLabel = STATUS_LABELS[obs.status]
  let displayStatusLabel = statusLabel

  if (obs.status === 'identified' && obs.species_name) {
    displayStatusLabel = `已鉴定·${obs.species_name}`
  }

  return {
    obs_id: obs.obs_id,
    photo_url: obs.photo_url,
    note: obs.note,
    location_name: obs.location_name,
    species_name: obs.species_name,
    status: obs.status,
    status_label: displayStatusLabel,
    submitted_at: obs.submitted_at,
    time_text: formatRelativeTime(obs.submitted_at),
    like_count: obs.like_count,
    comment_count: obs.comment_count,
    publisher: {
      user_id: obs.user_id,
      nickname: (user && user.nickname) || '小林同学',
      avatar_url: (user && user.avatar_url) || DEFAULT_AVATAR,
    },
  }
}

function getFeedObservations(): Observation[] {
  let list = getAllObservations()
  if (list.length === 0 && SEED_OBSERVATIONS.length > 0) {
    list = buildSeedObservations()
  }

  return list
    .filter((obs) => obs.status !== 'rejected' && obs.status !== 'pending_review')
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
}

function paginate(all: Observation[], page: number, pageSize: number): FeedListResult {
  const start = (page - 1) * pageSize
  const slice = all.slice(start, start + pageSize)
  return {
    list: slice.map(toFeedItem),
    total: all.length,
    hasMore: start + slice.length < all.length,
  }
}

export function listFeed(page: number, pageSize: number): FeedListResult {
  return paginate(getFeedObservations(), page, pageSize)
}

export function listMyFeed(userId: string, page: number, pageSize: number): FeedListResult {
  const all = getAllObservations()
    .filter((obs) => obs.user_id === userId)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  return paginate(all, page, pageSize)
}

function resolveStatus(params: CreateObservationParams): ObservationStatus {
  if (params.needs_identification) {
    return 'needs_identification'
  }
  return 'approved'
}

export function createObservation(params: CreateObservationParams): ObservationFeedItem {
  const speciesName = (params.species_name && params.species_name.trim()) || undefined
  const observation = addObservation({
    user_id: params.user_id,
    photo_url: params.photo_url,
    location_name: params.location_name.trim(),
    note: (params.note && params.note.trim()) || '',
    species_name: speciesName,
    status: resolveStatus(params),
  })

  return toFeedItem(observation)
}
