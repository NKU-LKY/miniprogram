import { request } from './client'
import type { PaginatedResult, RemoteLocation } from './types'

export async function findOrCreateLocation(params: {
  name: string
  latitude?: number
  longitude?: number
  description?: string
}): Promise<number> {
  const keyword = params.name.trim()
  if (!keyword) {
    throw new Error('地点名称不能为空')
  }

  const listed = await request<PaginatedResult<RemoteLocation>>('/api/locations', {
    query: { page: 1, pageSize: 20, keyword },
  })

  const exact = listed.list.find((item) => item.name === keyword)
  if (exact) return exact.locationId

  const created = await request<RemoteLocation>('/api/locations', {
    method: 'POST',
    data: {
      name: keyword,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      description: params.description ?? null,
    },
  })

  return created.locationId
}

export async function listAllLocations(pageSize = 100): Promise<RemoteLocation[]> {
  const first = await request<PaginatedResult<RemoteLocation>>('/api/locations', {
    query: { page: 1, pageSize },
  })
  return first.list
}
