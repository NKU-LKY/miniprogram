/** 校园预设地点（含模拟坐标，用于就近匹配设备定位） */
export interface CampusLocation {
  name: string
  latitude: number
  longitude: number
}

export const CAMPUS_LOCATION_POINTS: CampusLocation[] = [
  { name: '二食堂东门', latitude: 38.9912, longitude: 117.3516 },
  { name: '图书馆北侧', latitude: 38.9920, longitude: 117.3502 },
  { name: '三教楼顶', latitude: 38.9903, longitude: 117.3524 },
  { name: '樱花大道', latitude: 38.9926, longitude: 117.3531 },
  { name: '田径场看台', latitude: 38.9892, longitude: 117.3495 },
  { name: '校门口花坛', latitude: 38.9935, longitude: 117.3488 },
  { name: '行政楼前广场', latitude: 38.9914, longitude: 117.3490 },
  { name: '竹林小径', latitude: 38.9899, longitude: 117.3540 },
  { name: '植物园温室', latitude: 38.9883, longitude: 117.3528 },
  { name: '荷花池', latitude: 38.9886, longitude: 117.3508 },
]

export const CAMPUS_LOCATIONS = CAMPUS_LOCATION_POINTS.map((item) => item.name)

/** 校园地图默认中心与缩放级别 */
export const CAMPUS_MAP_CENTER = {
  latitude: 38.99,
  longitude: 117.35,
}

export const CAMPUS_MAP_SCALE = 15

export function getLocationByName(name: string): CampusLocation | undefined {
  return CAMPUS_LOCATION_POINTS.find((item) => item.name === name)
}
