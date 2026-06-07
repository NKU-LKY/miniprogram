/** 校园预设地点（含模拟坐标，用于就近匹配设备定位） */
export interface CampusLocation {
  name: string
  latitude: number
  longitude: number
}

export const CAMPUS_LOCATION_POINTS: CampusLocation[] = [
  { name: '理科学9', latitude: 38.9839, longitude: 117.3421 },
  { name: '图书馆', latitude: 38.9864, longitude: 117.3470 },
  { name: '计网学院楼', latitude: 38.9866, longitude: 117.3422 },
  { name: '公教楼C区', latitude: 38.9888, longitude: 117.3457 },
  { name: '东北角湿地', latitude: 38.9907, longitude: 117.3545 },
  { name: '理科体育场', latitude: 38.9855, longitude: 117.3391 },
  { name: '理科食堂', latitude: 38.9860, longitude: 117.3412 },
  { name: '体育馆', latitude: 38.9914, longitude: 117.3476 },
]

export const CAMPUS_LOCATIONS = CAMPUS_LOCATION_POINTS.map((item) => item.name)

/** 校园地图默认中心与缩放级别 */
export const CAMPUS_MAP_CENTER = {
  latitude: 38.9874,
  longitude: 117.3449,
}

export const CAMPUS_MAP_SCALE = 15

export function getLocationByName(name: string): CampusLocation | undefined {
  return CAMPUS_LOCATION_POINTS.find((item) => item.name === name)
}

/** 解析观测记录坐标：优先使用地图选点，否则回退到预设地点 */
export function resolveObservationCoordinate(obs: {
  location_name: string
  latitude?: number
  longitude?: number
}): CampusLocation | null {
  if (typeof obs.latitude === 'number' && typeof obs.longitude === 'number') {
    return {
      name: obs.location_name,
      latitude: obs.latitude,
      longitude: obs.longitude,
    }
  }
  const preset = getLocationByName(obs.location_name)
  return preset || null
}
