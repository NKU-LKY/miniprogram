/** 校园预设地点（含模拟坐标，用于就近匹配设备定位） */
export interface CampusLocation {
  name: string
  latitude: number
  longitude: number
}

export const CAMPUS_LOCATION_POINTS: CampusLocation[] = [
  { name: '二食堂东门', latitude: 30.2568, longitude: 120.1486 },
  { name: '图书馆北侧', latitude: 30.2576, longitude: 120.1472 },
  { name: '三教楼顶', latitude: 30.2559, longitude: 120.1494 },
  { name: '樱花大道', latitude: 30.2582, longitude: 120.1501 },
  { name: '田径场看台', latitude: 30.2548, longitude: 120.1465 },
  { name: '校门口花坛', latitude: 30.2591, longitude: 120.1458 },
  { name: '行政楼前广场', latitude: 30.2570, longitude: 120.1460 },
  { name: '竹林小径', latitude: 30.2555, longitude: 120.1510 },
  { name: '植物园温室', latitude: 30.2539, longitude: 120.1498 },
  { name: '荷花池', latitude: 30.2542, longitude: 120.1478 },
]

export const CAMPUS_LOCATIONS = CAMPUS_LOCATION_POINTS.map((item) => item.name)
