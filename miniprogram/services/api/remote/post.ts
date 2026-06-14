import { request } from './client'
import { hydrateObservationLocation } from './location'
import type { PaginatedResult, RemotePost, RemoteSpecies } from './types'
import { encodeSpeciesPayload } from './mappers'

const postIdCache = new Map<string, string>()
const speciesByIdCache = new Map<number, RemoteSpecies>()

export function cachePostId(obsId: string, postId: number | string): void {
  postIdCache.set(obsId, String(postId))
}

export async function getPostByObsId(obsId: string, status?: string): Promise<RemotePost | null> {
  if (!status) {
    const cached = postIdCache.get(obsId)
    if (cached) {
      try {
        return await request<RemotePost>(`/api/posts/${cached}`)
      } catch {
        postIdCache.delete(obsId)
      }
    }
  }

  const posts = await request<RemotePost[]>(`/api/posts/by-obs/${obsId}`, {
    query: status ? { status } : undefined,
  })

  const post = posts[0]
  if (post) {
    cachePostId(obsId, post.postId)
  }
  return post || null
}

export async function getPostIdByObsId(obsId: string): Promise<string | null> {
  const post = await getPostByObsId(obsId)
  return post ? String(post.postId) : null
}

export async function getSpeciesById(speciesId: number): Promise<RemoteSpecies | null> {
  const cached = speciesByIdCache.get(speciesId)
  if (cached) return cached

  try {
    const species = await request<RemoteSpecies>(`/api/species/${speciesId}`)
    speciesByIdCache.set(speciesId, species)
    return species
  } catch {
    return null
  }
}

export async function hydratePostObservation(post: RemotePost): Promise<RemotePost> {
  const obs = post.observation
  if (!obs) return post

  let nextObs = obs

  if (obs.species?.speciesId && !(obs.species.speciesName || '').trim()) {
    const fullSpecies = await getSpeciesById(obs.species.speciesId)
    if (fullSpecies) {
      nextObs = { ...nextObs, species: fullSpecies }
    }
  }

  if (obs.location?.locationId) {
    const fullLocation = await hydrateObservationLocation(nextObs.location)
    if (fullLocation && fullLocation !== nextObs.location) {
      nextObs = { ...nextObs, location: fullLocation }
    }
  }

  if (nextObs === obs) return post
  return { ...post, observation: nextObs }
}

export async function prefetchSpeciesForPosts(posts: RemotePost[]): Promise<void> {
  const pending = new Set<number>()
  for (const post of posts) {
    const species = post.observation?.species
    if (!species?.speciesId) continue
    if ((species.speciesName || '').trim()) continue
    if (speciesByIdCache.has(species.speciesId)) continue
    pending.add(species.speciesId)
  }
  await Promise.all([...pending].map((id) => getSpeciesById(id)))
}

async function findSpeciesByStoredName(storedName: string): Promise<RemoteSpecies | null> {
  const listed = await request<PaginatedResult<RemoteSpecies>>('/api/species', {
    query: { page: 1, pageSize: 50, keyword: storedName },
  })
  return listed.list.find((item) => item.speciesName === storedName) || null
}

async function findLegacySpeciesPair(
  remark: string,
  category: string,
): Promise<RemoteSpecies | null> {
  const listed = await request<PaginatedResult<RemoteSpecies>>('/api/species', {
    query: { page: 1, pageSize: 50, keyword: remark },
  })
  return (
    listed.list.find(
      (item) =>
        item.speciesName === remark && (item.description || '').trim() === category,
    ) || null
  )
}

export async function findOrCreateSpecies(category?: string, remark?: string): Promise<number | undefined> {
  const payload = encodeSpeciesPayload(category, remark)
  const storedName = payload.speciesName.trim()
  if (!storedName) return undefined

  const cat = (category || '').trim()
  const rem = (remark || '').trim()

  let existing = await findSpeciesByStoredName(storedName)
  if (!existing && cat && rem) {
    existing = await findLegacySpeciesPair(rem, cat)
  }

  if (existing?.speciesId) {
    speciesByIdCache.set(existing.speciesId, existing)
    return existing.speciesId
  }

  try {
    const created = await request<RemoteSpecies>('/api/species', {
      method: 'POST',
      data: {
        speciesName: storedName,
        description: payload.description || null,
      },
    })
    if (created.speciesId) speciesByIdCache.set(created.speciesId, created)
    return created.speciesId
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (!message.includes('已存在')) throw err

    const duplicate =
      (await findSpeciesByStoredName(storedName)) ||
      (cat && rem ? await findLegacySpeciesPair(rem, cat) : null)
    if (!duplicate?.speciesId) throw err
    speciesByIdCache.set(duplicate.speciesId, duplicate)
    return duplicate.speciesId
  }
}

export async function createPostForObservation(obsId: number, featured = false): Promise<RemotePost> {
  const post = await request<RemotePost>('/api/posts', {
    method: 'POST',
    data: {
      obsId,
      status: 'published',
      allowComment: true,
      priority: featured ? 1 : 0,
    },
  })
  cachePostId(String(obsId), post.postId)
  return post
}

export async function listPublishedPosts(params: {
  page: number
  pageSize: number
  priority?: number
  sortBy?: string
}): Promise<PaginatedResult<RemotePost>> {
  return request<PaginatedResult<RemotePost>>('/api/posts', {
    query: {
      page: params.page,
      pageSize: params.pageSize,
      status: 'published',
      priority: params.priority,
      sortBy: params.sortBy || 'created_at',
      order: 'DESC',
    },
  })
}

export async function getPostLikeCount(postId: string): Promise<number> {
  const data = await request<{ postId: number; likeCount: number }>(`/api/post-likes/count/${postId}`)
  return data.likeCount
}

export async function getPostCommentCount(postId: string): Promise<number> {
  const data = await request<{ postId: number; commentCount: number }>(
    `/api/comments/count/${postId}`,
    { query: { status: 'visible' } },
  )
  return data.commentCount
}

export async function checkPostLiked(postId: string, userId: string): Promise<boolean> {
  const data = await request<{ liked: boolean }>('/api/post-likes/check', {
    query: { postId, userId },
  })
  return data.liked
}
