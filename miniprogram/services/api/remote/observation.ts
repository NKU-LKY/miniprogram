import type {
  CreateObservationParams,
  FeedListResult,
  MapObservationItem,
  ObservationDetailItem,
  ObservationFeedItem,
} from '../../../types/observation'
import type { FilterOption, ObservationFilterParams } from '../../../utils/observation-filter'
import { applyObservationFilter, collectLocationOptions, collectSpeciesOptions } from '../../../utils/observation-filter'
import { getSpeciesMarkerLabel } from '../../../utils/map-markers'
import { normalizeMapLocation } from '../../../utils/map-locations'
import { formatSpeciesLabel } from '../../../utils/species-display'
import { formatFullTime, formatRelativeTime } from '../../../utils/time'
import { uploadFile, request } from './client'
import { findOrCreateLocation } from './location'
import {
  checkPostLiked,
  createPostForObservation,
  findOrCreateSpecies,
  getPostByObsId,
  getPostCommentCount,
  getPostIdByObsId,
  getPostLikeCount,
  listPublishedPosts,
  cachePostId,
} from './post'
import {
  getObservationPhotoUrl,
  mapCommentTree,
  mapObservationStatus,
  parseSpeciesFields,
  toFeedItem,
  toRemoteUserId,
  toUserId,
} from './mappers'
import type { PaginatedResult, RemoteObservation, RemotePost } from './types'

export type WithdrawObservationResult = { success: boolean; message?: string }
export type SetCommentsEnabledResult = {
  success: boolean
  message?: string
  comments_enabled?: boolean
}

async function enrichFeedItems(posts: RemotePost[]): Promise<ObservationFeedItem[]> {
  const items: ObservationFeedItem[] = []

  for (const post of posts) {
    if (!post.observation) continue
    const obsId = toUserId(post.observation.obsId)
    const postId = String(post.postId)
    cachePostId(obsId, post.postId)

    const [likeCount, commentCount] = await Promise.all([
      getPostLikeCount(postId).catch(() => 0),
      getPostCommentCount(postId).catch(() => 0),
    ])

    const item = toFeedItem(post, likeCount, commentCount)
    if (item) items.push(item)
  }

  return items
}

function remoteObsToLocalShape(obs: RemoteObservation, post?: RemotePost | null) {
  const species = parseSpeciesFields(obs.species)
  return {
    obs_id: toUserId(obs.obsId),
    user_id: toUserId(obs.user?.userId),
    species_name: species.species_name,
    species_remark: species.species_remark,
    location_name: obs.location?.name || '',
    latitude: obs.location?.latitude ?? undefined,
    longitude: obs.location?.longitude ?? undefined,
    note: obs.content || '',
    status: mapObservationStatus(obs.status, post?.status),
    submitted_at: obs.submittedAt,
    photo_url: getObservationPhotoUrl(obs),
    like_count: 0,
    comment_count: 0,
    is_featured: (post?.priority || 0) > 0,
    comments_enabled: post?.allowComment !== false,
  }
}

function applyClientFilter(
  observations: ReturnType<typeof remoteObsToLocalShape>[],
  filter?: ObservationFilterParams,
) {
  let result = applyObservationFilter(observations, filter)
  if (filter?.featuredOnly) {
    result = result.filter((obs) => obs.is_featured)
  }
  return result
}

export async function listFeedRemote(
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): Promise<FeedListResult> {
  const postsResult = await listPublishedPosts({
    page,
    pageSize: filter?.featuredOnly ? pageSize * 3 : pageSize,
    priority: filter?.featuredOnly ? 1 : undefined,
  })

  let items = await enrichFeedItems(postsResult.list)

  if (filter && (filter.species || filter.location || filter.timeRange || filter.featuredOnly)) {
    const shapes = items.map((item) => ({
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
      is_featured: item.is_featured,
    }))
    const filtered = applyClientFilter(shapes, filter)
    const allowed = new Set(filtered.map((obs) => obs.obs_id))
    items = items.filter((item) => allowed.has(item.obs_id))
  }

  const start = 0
  const slice = items.slice(start, pageSize)

  return {
    list: slice,
    total: postsResult.total,
    hasMore: page * pageSize < postsResult.total,
  }
}

export async function listMyFeedRemote(
  userId: string,
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): Promise<FeedListResult> {
  const result = await request<PaginatedResult<RemoteObservation>>(`/api/observations/user/${userId}`, {
    query: { page: 1, pageSize: 200 },
  })

  const posts = await Promise.all(
    result.list.map(async (obs) => {
      const post = await getPostByObsId(String(obs.obsId)).catch(() => null)
      return { obs, post }
    }),
  )

  const shapes = posts
    .filter(({ obs, post }) => mapObservationStatus(obs.status, post?.status) !== 'withdrawn')
    .map(({ obs, post }) => remoteObsToLocalShape(obs, post))

  const filtered = applyClientFilter(shapes, filter)
  const start = (page - 1) * pageSize
  const slice = filtered.slice(start, start + pageSize)

  const list: ObservationFeedItem[] = []
  for (const shape of slice) {
    const post = await getPostByObsId(shape.obs_id).catch(() => null)
    if (!post) continue
    const [likeCount, commentCount] = await Promise.all([
      getPostLikeCount(String(post.postId)).catch(() => 0),
      getPostCommentCount(String(post.postId)).catch(() => 0),
    ])
    const item = toFeedItem(post, likeCount, commentCount)
    if (item) list.push(item)
  }

  return {
    list,
    total: filtered.length,
    hasMore: start + slice.length < filtered.length,
  }
}

export async function getObservationDetailRemote(
  obsId: string,
  viewerUserId?: string,
): Promise<ObservationDetailItem | null> {
  const obs = await request<RemoteObservation>(`/api/observations/${obsId}`).catch(() => null)
  if (!obs) return null

  const post = await getPostByObsId(obsId).catch(() => null)
  const status = mapObservationStatus(obs.status, post?.status)

  if (status === 'withdrawn') return null

  const isOwner = Boolean(viewerUserId && toUserId(obs.user?.userId) === viewerUserId)
  let isAdmin = false
  if (viewerUserId) {
    const viewer = await request<{ role: string }>(`/api/users/${viewerUserId}`).catch(() => null)
    isAdmin = viewer?.role === 'admin'
  }

  if ((status === 'rejected' || status === 'pending_review') && !isOwner && !isAdmin) {
    return null
  }

  const postId = post ? String(post.postId) : await getPostIdByObsId(obsId)
  const [likeCount, commentCount, liked, comments] = await Promise.all([
    postId ? getPostLikeCount(postId).catch(() => 0) : Promise.resolve(0),
    postId ? getPostCommentCount(postId).catch(() => 0) : Promise.resolve(0),
    postId && viewerUserId
      ? checkPostLiked(postId, viewerUserId).catch(() => false)
      : Promise.resolve(false),
    postId
      ? request<PaginatedResult<import('./types').RemoteComment>>(`/api/comments/by-post/${postId}`, {
          query: { page: 1, pageSize: 50, status: 'visible' },
        })
          .then((res) => mapCommentTree(res.list))
          .catch(() => [])
      : Promise.resolve([]),
  ])

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

  const feedItem = toFeedItem(feedPost, likeCount, commentCount)
  if (!feedItem) return null

  return {
    ...feedItem,
    time_full: formatFullTime(obs.submittedAt),
    liked,
    comments_enabled: post?.allowComment !== false,
    comments,
  }
}

export async function createObservationRemote(
  params: CreateObservationParams,
): Promise<ObservationFeedItem> {
  const locationId = await findOrCreateLocation({
    name: params.location_name,
    latitude: params.latitude,
    longitude: params.longitude,
    description: params.location_detail,
  })

  const speciesId = await findOrCreateSpecies(params.species_name, params.species_remark)

  const status = params.needs_identification ? 'needs_identification' : 'approved'

  const formData: Record<string, string | number> = {
    userId: toRemoteUserId(params.user_id),
    locationId,
    content: params.note || '',
    status,
  }
  if (speciesId) formData.speciesId = speciesId

  const obs = await uploadFile<RemoteObservation>(
    '/api/observations',
    params.photo_url,
    'photos',
    formData,
  )

  const post = await createPostForObservation(obs.obsId)

  if (params.needs_identification) {
    await request('/api/identification-requests', {
      method: 'POST',
      data: {
        obsId: obs.obsId,
        reqSpeciesName: params.species_remark || params.species_name || undefined,
      },
    }).catch((err) => console.warn('create identification request failed:', err))
  }

  const item = toFeedItem(post, 0, 0)
  if (!item) throw new Error('创建观测记录失败')
  return item
}

export async function withdrawObservationRemote(
  obsId: string,
  userId: string,
): Promise<WithdrawObservationResult> {
  try {
    const postId = await getPostIdByObsId(obsId)
    if (postId) {
      await request(`/api/posts/${postId}`, {
        method: 'PUT',
        data: { status: 'deleted' },
      })
    }

    await request(`/api/observations/${obsId}`, {
      method: 'DELETE',
      data: { userId: toRemoteUserId(userId) },
    })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '撤回失败',
    }
  }
}

export async function setObservationCommentsEnabledRemote(
  obsId: string,
  userId: string,
  enabled: boolean,
): Promise<SetCommentsEnabledResult> {
  try {
    const obs = await request<RemoteObservation>(`/api/observations/${obsId}`)
    if (toUserId(obs.user?.userId) !== userId) {
      return { success: false, message: '只能管理自己发布的记录' }
    }

    const postId = await getPostIdByObsId(obsId)
    if (!postId) return { success: false, message: '帖子不存在' }

    await request(`/api/posts/${postId}`, {
      method: 'PUT',
      data: { allowComment: enabled },
    })

    return { success: true, comments_enabled: enabled }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '操作失败',
    }
  }
}

export async function getFeedSpeciesOptionsRemote(): Promise<FilterOption[]> {
  const posts = await listPublishedPosts({ page: 1, pageSize: 100 })
  const items = await enrichFeedItems(posts.list)
  return collectSpeciesOptions(
    items.map((item) => ({
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
  )
}

export async function getFeedLocationOptionsRemote(): Promise<FilterOption[]> {
  const posts = await listPublishedPosts({ page: 1, pageSize: 100 })
  const items = await enrichFeedItems(posts.list)
  return collectLocationOptions(
    items.map((item) => ({
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
  )
}

export async function getMySpeciesOptionsRemote(userId: string): Promise<FilterOption[]> {
  const result = await listMyFeedRemote(userId, 1, 200)
  return collectSpeciesOptions(
    result.list.map((item) => ({
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
  )
}

export async function getMyLocationOptionsRemote(userId: string): Promise<FilterOption[]> {
  const result = await listMyFeedRemote(userId, 1, 200)
  return collectLocationOptions(
    result.list.map((item) => ({
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
  )
}

export async function listMapObservationsRemote(
  filter?: ObservationFilterParams,
): Promise<MapObservationItem[]> {
  const posts = await listPublishedPosts({ page: 1, pageSize: 200 })
  const items = await enrichFeedItems(posts.list)

  const shapes = items.map((item) => ({
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
  }))

  return applyClientFilter(shapes, filter)
    .map((obs) => {
      const normalized = normalizeMapLocation({
        ...obs,
        location_detail: undefined,
        latitude: undefined,
        longitude: undefined,
      })
      if (!normalized) return null

      const speciesLabel = formatSpeciesLabel(obs.species_name, obs.species_remark)
      return {
        obs_id: obs.obs_id,
        photo_url: obs.photo_url,
        note: obs.note,
        location_name: normalized.location_name,
        species_name: obs.species_name,
        species_remark: obs.species_remark,
        species_label: speciesLabel || undefined,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        location_key: normalized.location_key,
        marker_label: getSpeciesMarkerLabel(obs.species_name),
        submitted_at: obs.submitted_at,
        time_text: formatRelativeTime(obs.submitted_at),
      } satisfies MapObservationItem
    })
    .filter((item): item is MapObservationItem => item !== null)
}
