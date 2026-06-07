import { CAMPUS_LOCATION_POINTS, type CampusLocation } from '../data/locations'

export interface GeoCoordinate {
  latitude: number
  longitude: number
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 计算两点球面距离（米） */
export function getDistanceMeters(a: GeoCoordinate, b: GeoCoordinate): number {
  const earthRadius = 6371000
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

/** 根据设备坐标匹配最近的校园地点 */
export function findNearestCampusLocation(coord: GeoCoordinate): CampusLocation {
  let nearest = CAMPUS_LOCATION_POINTS[0]
  let minDistance = Number.POSITIVE_INFINITY

  for (const point of CAMPUS_LOCATION_POINTS) {
    const distance = getDistanceMeters(coord, point)
    if (distance < minDistance) {
      minDistance = distance
      nearest = point
    }
  }

  return nearest
}

/** 将地图坐标格式化为可读的地点描述 */
export function formatMapAddress(coord: GeoCoordinate): string {
  const lat = Math.abs(coord.latitude).toFixed(4)
  const lng = Math.abs(coord.longitude).toFixed(4)
  const latPrefix = coord.latitude >= 0 ? '北纬' : '南纬'
  const lngPrefix = coord.longitude >= 0 ? '东经' : '西经'
  return `${latPrefix}${lat}°，${lngPrefix}${lng}°`
}

export function hasValidCoordinate(coord?: GeoCoordinate | null): coord is GeoCoordinate {
  return (
    coord != null &&
    typeof coord.latitude === 'number' &&
    typeof coord.longitude === 'number' &&
    !Number.isNaN(coord.latitude) &&
    !Number.isNaN(coord.longitude)
  )
}

export function getDeviceLocation(): Promise<GeoCoordinate> {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
        })
      },
      fail: (err) => reject(err),
    })
  })
}
