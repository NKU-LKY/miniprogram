import { getSpeciesCategory } from '../data/species-categories'
import type { MapLocationGroup } from '../types/observation'

/** 根据物种类别（大类）返回地图标记图标 */
export function getSpeciesMarkerLabel(categoryName?: string): string {
  const category = getSpeciesCategory(categoryName)
  if (category) return category.marker_label

  const name = (categoryName || '').trim()
  if (!name) return '❓'

  if (/猫|狗|鼠|兔|松鼠|刺猬|哺乳/.test(name)) return '🐾'
  if (/鸟|雀|鹊|鹰|鸭|鹅|鸽/.test(name)) return '🐦'
  if (/鱼|鲤|鲫/.test(name)) return '🐟'
  if (/蝶|蛾|蜂|虫|蜻蜓|瓢虫|昆虫/.test(name)) return '🦋'
  if (/花|树|竹|樱|桂|银杏|荷|草|叶|松|梅|藤|蕨|植物|温室/.test(name)) return '🌿'

  return '📍'
}

function buildSpeciesCalloutSuffix(group: MapLocationGroup): string {
  if (group.species_list.length === 0) return '待鉴定'
  if (group.species_list.length === 1) return group.species_list[0].name
  const top = group.species_list.slice(0, 2).map((item) => item.name)
  const rest = group.species_list.length - top.length
  return rest > 0 ? `${top.join('、')}等` : top.join('、')
}

/** 圆形标记：等宽高图标 + 居中锚点，点击热区覆盖整个圆 */
const MARKER_ICON = '/assets/map-marker-circle.png'
const MARKER_SIZE = 40
const MARKER_FONT_SIZE = 14

/** label 原点为经纬度，用固定尺寸 + 负偏移将物种图标置于圆心 */
function getMarkerLabelAnchor(): { anchorX: number; anchorY: number } {
  const half = MARKER_SIZE / 2
  let anchorX = 0

  try {
    if (wx.getSystemInfoSync().platform === 'android') {
      anchorX = -half
    }
  } catch {
    anchorX = -half
  }

  return { anchorX, anchorY: -half }
}

export function buildMapMarkers(groups: MapLocationGroup[]): WechatMiniprogram.MapMarker[] {
  const labelAnchor = getMarkerLabelAnchor()

  return groups.map((group, index) => {
    const speciesHint = buildSpeciesCalloutSuffix(group)
    const countHint = group.record_count > 1 ? `${group.record_count} 条记录` : '1 条记录'
    const calloutContent = `${group.location_name} · ${countHint} · ${speciesHint}`

    return {
      id: index + 1,
      latitude: group.latitude,
      longitude: group.longitude,
      iconPath: MARKER_ICON,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      anchor: { x: 0.5, y: 0.5 },
      title: group.location_name,
      label: {
        content: group.record_count > 1 ? `${group.marker_label}${group.record_count}` : group.marker_label,
        width: MARKER_SIZE,
        height: MARKER_SIZE,
        color: '#2d5a2e',
        fontSize: MARKER_FONT_SIZE,
        padding: (MARKER_SIZE - MARKER_FONT_SIZE) / 2,
        anchorX: labelAnchor.anchorX,
        anchorY: labelAnchor.anchorY,
        textAlign: 'center',
      },
      callout: {
        content: calloutContent,
        display: 'BYCLICK',
        padding: 10,
        borderRadius: 8,
        fontSize: 12,
        color: '#2d5a2e',
        bgColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#d8e8d8',
      },
    }
  })
}
