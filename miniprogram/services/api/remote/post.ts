import { request } from './client'
import type { PaginatedResult, RemotePost, RemoteSpecies } from './types'
import { encodeSpeciesPayload } from './mappers'

const postIdCache = new Map<string, string>()

export function cachePostId(obsId: string, postId: number | string): void {
  postIdCache.set(obsId, String(postId))
}

export async function getPostByObsId(obsId: string, status?: string): Promise<RemotePost | null> {
  const cached = postIdCache.get(obsId)
  if (cached) {
    try {
      return await request<RemotePost>(`/api/posts/${cached}`)
    } catch {
      postIdCache.delete(obsId)
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

export async function findOrCreateSpecies(category?: string, remark?: string): Promise<number | undefined> {
  const payload = encodeSpeciesPayload(category, remark)
  const name = payload.speciesName.trim()
  if (!name) return undefined

  const listed = await request<PaginatedResult<RemoteSpecies>>('/api/species', {
    query: { page: 1, pageSize: 20, keyword: name },
  })

  const exact = listed.list.find(
    (item) =>
      item.speciesName === name &&
      (payload.description ? item.description === payload.description : true),
  )
  if (exact) return exact.speciesId

  const created = await request<RemoteSpecies>('/api/species', {
    method: 'POST',
    data: {
      speciesName: name,
      description: payload.description || null,
    },
  })
  return created.speciesId
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
