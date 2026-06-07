import { getLocationByName, resolveObservationCoordinate } from '../data/locations'
import type { MapLocationGroup, MapObservationItem } from '../types/observation'
import { findNearestCampusLocation, getDistanceMeters, hasValidCoordinate } from './geo'
import { getSpeciesMarkerLabel } from './map-markers'

/** 判定为校园内的最大距离（米）：超出则视为独立自定义地点 */
const CAMPUS_SNAP_MAX_DISTANCE_METERS = 1500

/** 根据坐标生成地点唯一键（约 1 米精度） */
export function getLocationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`
}

function parseCoordinate(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

/** 将观测记录归一化到校园预设地点或独立坐标，便于地图聚合统计 */
export function normalizeMapLocation(obs: {
  location_name: string
  latitude?: number | string
  longitude?: number | string
}): {
  location_key: string
  location_name: string
  latitude: number
  longitude: number
} | null {
  const resolved = resolveObservationCoordinate(obs)
  if (!resolved) return null

  const trimmedName = (obs.location_name || '').trim()
  const presetByName = trimmedName ? getLocationByName(trimmedName) : undefined
  if (presetByName) {
    return {
      location_key: `preset:${presetByName.name}`,
      location_name: presetByName.name,
      latitude: presetByName.latitude,
      longitude: presetByName.longitude,
    }
  }

  const latitude = parseCoordinate(obs.latitude)
  const longitude = parseCoordinate(obs.longitude)
  const coord =
    latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : { latitude: resolved.latitude, longitude: resolved.longitude }

  if (hasValidCoordinate(coord)) {
    const nearest = findNearestCampusLocation(coord)
    const distance = getDistanceMeters(coord, nearest)

    if (distance <= CAMPUS_SNAP_MAX_DISTANCE_METERS) {
      return {
        location_key: `preset:${nearest.name}`,
        location_name: nearest.name,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
      }
    }

    return {
      location_key: `coord:${getLocationKey(coord.latitude, coord.longitude)}`,
      location_name: resolved.name,
      latitude: coord.latitude,
      longitude: coord.longitude,
    }
  }

  return {
    location_key: `coord:${getLocationKey(resolved.latitude, resolved.longitude)}`,
    location_name: resolved.name,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  }
}

/** 将观测记录按地点聚合（同一预设地标或同一坐标视为同一地点） */
export function groupMapObservationsByLocation(items: MapObservationItem[]): MapLocationGroup[] {
  const groups = new Map<string, MapObservationItem[]>()

  items.forEach((item) => {
    const key =
      item.location_key || getLocationKey(item.latitude, item.longitude)
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  })

  return Array.from(groups.entries())
    .map(([locationKey, records]) => {
      const sorted = [...records].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      )
      const latest = sorted[0]
      const speciesCounts = new Map<string, number>()

      sorted.forEach((record) => {
        const name = (record.species_name && record.species_name.trim()) || '待鉴定'
        speciesCounts.set(name, (speciesCounts.get(name) || 0) + 1)
      })

      const species_list = Array.from(speciesCounts.entries())
        .map(([name, count]) => ({
          name,
          count,
          marker_label: getSpeciesMarkerLabel(name === '待鉴定' ? undefined : name),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))

      return {
        location_key: locationKey,
        location_name: latest.location_name,
        latitude: latest.latitude,
        longitude: latest.longitude,
        record_count: sorted.length,
        species_list,
        records: sorted,
        marker_label: latest.marker_label,
      } satisfies MapLocationGroup
    })
    .sort((a, b) => b.record_count - a.record_count || a.location_name.localeCompare(b.location_name, 'zh-CN'))
}
