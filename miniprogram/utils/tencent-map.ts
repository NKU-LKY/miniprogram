import { TENCENT_MAP_KEY } from '../config/tencent-map'
import { findNearestCampusLocation, type GeoCoordinate } from './geo'

interface TencentPoi {
  title?: string
  category?: string
  _distance?: number
}

interface TencentLandmarkRef {
  title?: string
}

interface TencentGeocoderResult {
  status: number
  message?: string
  result?: {
    address?: string
    formatted_addresses?: {
      recommend?: string
      rough?: string
    }
    address_reference?: {
      landmark_l2?: TencentLandmarkRef
      landmark_l1?: TencentLandmarkRef
      famous_area?: TencentLandmarkRef
    }
    pois?: TencentPoi[]
  }
}

interface LandmarkCacheEntry {
  name: string
  expiresAt: number
}

const COORDINATE_LABEL_RE = /[南北]纬.*[东西]经/
const LOW_PRIORITY_CATEGORY_RE = /^(地名地址|基础设施:交通设施)/
const CACHE_STORAGE_KEY = 'campus_bio_landmark_cache_v1'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 200

let quotaWarned = false

function resolveCampusFallback(coord: GeoCoordinate): string {
  return findNearestCampusLocation(coord).name
}

/** 判断地点文案是否为经纬度格式（旧数据或 API 降级结果） */
export function isCoordinateLabel(name: string): boolean {
  return COORDINATE_LABEL_RE.test(name)
}

function toCacheKey(coord: GeoCoordinate): string {
  return `${coord.latitude.toFixed(4)},${coord.longitude.toFixed(4)}`
}

function readLandmarkCache(): Record<string, LandmarkCacheEntry> {
  try {
    const raw = wx.getStorageSync(CACHE_STORAGE_KEY) as Record<string, LandmarkCacheEntry> | undefined
    if (!raw || typeof raw !== 'object') return {}
    const now = Date.now()
    const valid: Record<string, LandmarkCacheEntry> = {}
    Object.keys(raw).forEach((key) => {
      const entry = raw[key]
      if (entry && entry.name && entry.expiresAt > now) {
        valid[key] = entry
      }
    })
    return valid
  } catch {
    return {}
  }
}

function writeLandmarkCache(cache: Record<string, LandmarkCacheEntry>): void {
  const keys = Object.keys(cache)
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys
      .sort((a, b) => cache[a].expiresAt - cache[b].expiresAt)
      .slice(0, keys.length - MAX_CACHE_ENTRIES)
      .forEach((key) => delete cache[key])
  }
  try {
    wx.setStorageSync(CACHE_STORAGE_KEY, cache)
  } catch (err) {
    console.warn('[tencent-map] cache write failed:', err)
  }
}

function getCachedLandmark(coord: GeoCoordinate): string | null {
  const cache = readLandmarkCache()
  const entry = cache[toCacheKey(coord)]
  return entry?.name || null
}

function setCachedLandmark(coord: GeoCoordinate, name: string): void {
  const trimmed = name.trim()
  if (!trimmed || isCoordinateLabel(trimmed)) return
  const cache = readLandmarkCache()
  cache[toCacheKey(coord)] = {
    name: trimmed,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  writeLandmarkCache(cache)
}

function parseResponseData(data: unknown): TencentGeocoderResult | null {
  if (!data) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as TencentGeocoderResult
    } catch {
      return null
    }
  }
  if (typeof data === 'object') {
    return data as TencentGeocoderResult
  }
  return null
}

function pickLandmarkName(result: TencentGeocoderResult['result']): string | null {
  if (!result) return null

  const recommend = result.formatted_addresses?.recommend?.trim()
  if (recommend) return recommend

  const landmarkL2 = result.address_reference?.landmark_l2?.title?.trim()
  if (landmarkL2) return landmarkL2

  const landmarkL1 = result.address_reference?.landmark_l1?.title?.trim()
  if (landmarkL1) return landmarkL1

  const famousArea = result.address_reference?.famous_area?.title?.trim()
  if (famousArea) return famousArea

  const pois = result.pois
  if (pois && pois.length > 0) {
    const sorted = [...pois].sort((a, b) => (a._distance ?? 0) - (b._distance ?? 0))
    const preferred = sorted.find(
      (item) => item.title?.trim() && !LOW_PRIORITY_CATEGORY_RE.test(item.category || ''),
    )
    if (preferred?.title) return preferred.title.trim()

    const nearest = sorted.find((item) => item.title?.trim())
    if (nearest?.title) return nearest.title.trim()
  }

  const rough = result.formatted_addresses?.rough?.trim()
  if (rough) return rough

  const address = result.address?.trim()
  if (address) return address

  return null
}

function notifyGeocoderError(status: number, message?: string): void {
  if (status === 121) {
    if (!quotaWarned) {
      quotaWarned = true
      wx.showToast({
        title: '地图额度已用完，已匹配最近校园地标',
        icon: 'none',
        duration: 2500,
      })
    }
    return
  }

  if (status === 110 || status === 311) {
    console.warn('[tencent-map] key unauthorized:', status, message)
    if (!quotaWarned) {
      quotaWarned = true
      wx.showToast({
        title: '地图 Key 未授权，请检查配置',
        icon: 'none',
        duration: 2500,
      })
    }
  }
}

/** 调用腾讯地图逆地址解析，返回附近地标名称 */
export function resolveNearbyLandmark(coord: GeoCoordinate): Promise<string> {
  const cached = getCachedLandmark(coord)
  if (cached) {
    return Promise.resolve(cached)
  }

  if (!TENCENT_MAP_KEY) {
    console.warn('[tencent-map] 未配置 TENCENT_MAP_KEY，回退到最近校园地标')
    return Promise.resolve(resolveCampusFallback(coord))
  }

  return new Promise((resolve) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: `${coord.latitude},${coord.longitude}`,
        key: TENCENT_MAP_KEY,
        get_poi: 1,
        poi_options: 'policy=1;radius=1000;orderby=_distance',
      },
      success: (res) => {
        const data = parseResponseData(res.data)
        if (!data) {
          console.warn('[tencent-map] invalid response')
          resolve(resolveCampusFallback(coord))
          return
        }

        if (data.status === 0) {
          const name = pickLandmarkName(data.result)
          if (name) {
            setCachedLandmark(coord, name)
            resolve(name)
            return
          }
        } else {
          notifyGeocoderError(data.status, data.message)
          console.warn('[tencent-map] geocoder failed:', data.status, data.message)
        }

        resolve(resolveCampusFallback(coord))
      },
      fail: (err) => {
        console.warn('[tencent-map] request failed:', err)
        resolve(resolveCampusFallback(coord))
      },
    })
  })
}
