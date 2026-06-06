import type { MapObservationItem } from '../types/observation'

/** 根据物种名称推断地图标记图标 */
export function getSpeciesMarkerLabel(speciesName?: string): string {
  const name = (speciesName || '').trim()
  if (!name) return '❓'

  if (/猫|狗|鼠|兔|松鼠|刺猬/.test(name)) return '🐾'
  if (/鸟|雀|鹊|鹰|鸭|鹅|鸽/.test(name)) return '🐦'
  if (/鱼|鲤|鲫/.test(name)) return '🐟'
  if (/蝶|蛾|蜂|虫|蜻蜓|瓢虫/.test(name)) return '🦋'
  if (/花|树|竹|樱|桂|银杏|荷|草|叶|松|梅|藤|蕨|植物|温室/.test(name)) return '🌿'

  return '📍'
}

export function buildMapMarkers(items: MapObservationItem[]): WechatMiniprogram.MapMarker[] {
  return items.map((item, index) => {
    const title = item.species_name || '待鉴定'
    const calloutContent = item.species_name
      ? `${item.location_name} · ${item.species_name}`
      : `${item.location_name} · 待鉴定`

    return {
      id: index + 1,
      latitude: item.latitude,
      longitude: item.longitude,
      title,
      label: {
        content: item.marker_label,
        color: '#2d5a2e',
        fontSize: 14,
        anchorX: 0,
        anchorY: -36,
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
