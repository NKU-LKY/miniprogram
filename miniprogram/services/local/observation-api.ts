import { SEED_OBSERVATIONS } from '../../data/observations.seed'
import { resolveObservationCoordinate } from '../../data/locations'
import type {
  CreateObservationParams,
  FeedListResult,
  MapObservationItem,
  Observation,
  ObservationDetailItem,
  ObservationFeedItem,
  ObservationStatus,
} from '../../types/observation'
import type { FilterOption, ObservationFilterParams } from '../../utils/observation-filter'
import { applyObservationFilter, collectSpeciesOptions } from '../../utils/observation-filter'
import { getSpeciesMarkerLabel } from '../../utils/map-markers'
import { formatFullTime, formatRelativeTime } from '../../utils/time'
import { isObservationLiked, listObservationComments } from './interaction-api'
import { isObservationFeatured, setObservationFeatured } from './featured-store'
import {
  addObservation,
  buildSeedObservations,
  getAllObservations,
  withdrawObservationByOwner,
} from './observation-store'
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
    location_detail: obs.location_detail,
    species_name: obs.species_name,
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

function getFeedObservations(): Observation[] {
  let list = getAllObservations()
  if (list.length === 0 && SEED_OBSERVATIONS.length > 0) {
    list = buildSeedObservations()
  }

  return list
    .filter(
      (obs) =>
        obs.status !== 'rejected' &&
        obs.status !== 'pending_review' &&
        obs.status !== 'withdrawn',
    )
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
}

function applyListFilter(
  observations: Observation[],
  filter?: ObservationFilterParams,
): Observation[] {
  let result = applyObservationFilter(observations, filter)
  if (filter && filter.featuredOnly) {
    result = result.filter((obs) => isObservationFeatured(obs.obs_id))
  }
  return result
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

export function listFeed(
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): FeedListResult {
  const filtered = applyListFilter(getFeedObservations(), filter)
  return paginate(filtered, page, pageSize)
}

export function getObservationDetail(
  obsId: string,
  viewerUserId?: string,
): ObservationDetailItem | null {
  const trimmedId = obsId.trim()
  const obs = getAllObservations().find((item) => item.obs_id === trimmedId)
  if (!obs) return null

  if (obs.status === 'withdrawn') return null

  const isOwner = Boolean(viewerUserId && obs.user_id === viewerUserId)
  const viewer = viewerUserId ? findUserById(viewerUserId) : undefined
  const isAdmin = viewer ? viewer.role === 'admin' : false
  if ((obs.status === 'rejected' || obs.status === 'pending_review') && !isOwner && !isAdmin) {
    return null
  }

  const feedItem = toFeedItem(obs)
  return {
    ...feedItem,
    time_full: formatFullTime(obs.submitted_at),
    liked: isObservationLiked(trimmedId, viewerUserId),
    comments: listObservationComments(trimmedId),
  }
}

export function listMyFeed(
  userId: string,
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): FeedListResult {
  const all = getAllObservations()
    .filter((obs) => obs.user_id === userId && obs.status !== 'withdrawn')
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  const filtered = applyListFilter(all, filter)
  return paginate(filtered, page, pageSize)
}

function resolveStatus(params: CreateObservationParams): ObservationStatus {
  if (params.needs_identification) {
    return 'needs_identification'
  }
  return 'approved'
}

export function getFeedSpeciesOptions(): FilterOption[] {
  return collectSpeciesOptions(getFeedObservations())
}

export function getMySpeciesOptions(userId: string): FilterOption[] {
  const all = getAllObservations()
    .filter((obs) => obs.user_id === userId && obs.status !== 'withdrawn')
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  return collectSpeciesOptions(all)
}

export function listMapObservations(filter?: ObservationFilterParams): MapObservationItem[] {
  return applyListFilter(getFeedObservations(), filter)
    .map((obs) => {
      const point = resolveObservationCoordinate(obs)
      if (!point) return null

      return {
        obs_id: obs.obs_id,
        photo_url: obs.photo_url,
        note: obs.note,
        location_name: obs.location_name,
        species_name: obs.species_name,
        latitude: point.latitude,
        longitude: point.longitude,
        marker_label: getSpeciesMarkerLabel(obs.species_name),
        submitted_at: obs.submitted_at,
        time_text: formatRelativeTime(obs.submitted_at),
      } satisfies MapObservationItem
    })
    .filter((item): item is MapObservationItem => item !== null)
}

export function createObservation(params: CreateObservationParams): ObservationFeedItem {
  const speciesName = (params.species_name && params.species_name.trim()) || undefined
  const observation = addObservation({
    user_id: params.user_id,
    photo_url: params.photo_url,
    location_name: params.location_name.trim(),
    location_detail: (params.location_detail && params.location_detail.trim()) || undefined,
    latitude: params.latitude,
    longitude: params.longitude,
    note: (params.note && params.note.trim()) || '',
    species_name: speciesName,
    status: resolveStatus(params),
  })

  return toFeedItem(observation)
}

export interface WithdrawObservationResult {
  success: boolean
  message?: string
}

export function withdrawObservation(obsId: string, userId: string): WithdrawObservationResult {
  const result = withdrawObservationByOwner(obsId, userId)

  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      invalid: '参数无效',
      not_found: '记录不存在',
      not_owner: '只能撤回自己发布的记录',
      already_withdrawn: '该记录已撤回',
    }
    return { success: false, message: messages[result.reason] }
  }

  const trimmedId = obsId.trim()
  try {
    if (isObservationFeatured(trimmedId)) {
      setObservationFeatured(trimmedId, false)
    }
  } catch (err) {
    console.warn('withdrawObservation: clear featured failed', err)
  }

  return { success: true }
}
