import { request } from './client'
import type { PaginatedResult, RemoteLocation } from './types'

const locationByIdCache = new Map<number, RemoteLocation>()

export async function getLocationById(locationId: number): Promise<RemoteLocation | null> {
  const cached = locationByIdCache.get(locationId)
  if (cached) return cached

  try {
    const location = await request<RemoteLocation>(`/api/locations/${locationId}`)
    locationByIdCache.set(locationId, location)
    return location
  } catch {
    return null
  }
}

export async function findOrCreateLocation(params: {
  name: string
  latitude?: number
  longitude?: number
  description?: string
}): Promise<number> {
  const keyword = params.name.trim()
  const detail = (params.description || '').trim()
  if (!keyword) {
    throw new Error('地点名称不能为空')
  }

  const listed = await request<PaginatedResult<RemoteLocation>>('/api/locations', {
    query: { page: 1, pageSize: 20, keyword },
  })

  const sameName = listed.list.find((item) => item.name === keyword)
  if (sameName) {
    const existingDetail = (sameName.description || '').trim()

    if (!detail || detail === existingDetail) {
      if (detail && !existingDetail) {
        const updated = await request<RemoteLocation>(`/api/locations/${sameName.locationId}`, {
          method: 'PUT',
          data: { description: detail },
        })
        locationByIdCache.set(updated.locationId, updated)
        return updated.locationId
      }
      locationByIdCache.set(sameName.locationId, sameName)
      return sameName.locationId
    }
  }

  const created = await request<RemoteLocation>('/api/locations', {
    method: 'POST',
    data: {
      name: keyword,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      description: detail || null,
    },
  })

  locationByIdCache.set(created.locationId, created)
  return created.locationId
}

export async function hydrateObservationLocation(
  location: RemoteLocation | null | undefined,
): Promise<RemoteLocation | null | undefined> {
  if (!location?.locationId) return location
  if ((location.description || '').trim()) return location

  const full = await getLocationById(location.locationId)
  return full || location
}

export async function listAllLocations(pageSize = 100): Promise<RemoteLocation[]> {
  const first = await request<PaginatedResult<RemoteLocation>>('/api/locations', {
    query: { page: 1, pageSize },
  })
  return first.list
}
