import type { Observation } from '../types/observation'
import type {
  SpeciesArchiveDetail,
  SpeciesArchiveSummary,
  SpeciesLocationStat,
  SpeciesPhotoItem,
  SpeciesRelatedRecord,
} from '../types/species'
import { getSpeciesMarkerLabel } from './map-markers'
import { isAnimalSpecies } from './species-meta'
import { formatRelativeTime } from './time'

const TIME_SLOTS = [
  { label: '凌晨', start: 0, end: 5 },
  { label: '清晨', start: 5, end: 8 },
  { label: '上午', start: 8, end: 12 },
  { label: '午后', start: 12, end: 14 },
  { label: '下午', start: 14, end: 17 },
  { label: '傍晚', start: 17, end: 19 },
  { label: '晚上', start: 19, end: 22 },
  { label: '深夜', start: 22, end: 24 },
]

function hasSpeciesName(obs: Observation): obs is Observation & { species_name: string } {
  return Boolean(obs.species_name && obs.species_name.trim())
}

function groupBySpecies(observations: Observation[]): Map<string, Observation[]> {
  const groups = new Map<string, Observation[]>()

  observations.forEach((obs) => {
    if (!hasSpeciesName(obs)) return
    const name = obs.species_name.trim()
    const list = groups.get(name) || []
    list.push(obs)
    groups.set(name, list)
  })

  return groups
}

export function computeActivePeriods(timestamps: string[]): string {
  if (timestamps.length === 0) return '暂无足够观测数据'

  const slotCounts = TIME_SLOTS.map(() => 0)
  timestamps.forEach((ts) => {
    const hour = new Date(ts).getHours()
    const idx = TIME_SLOTS.findIndex((slot) => hour >= slot.start && hour < slot.end)
    if (idx >= 0) slotCounts[idx] += 1
  })

  const maxCount = Math.max(...slotCounts)
  if (maxCount === 0) return '暂无足够观测数据'

  const threshold = Math.max(1, Math.ceil(maxCount * 0.5))
  const activeSlots = TIME_SLOTS.filter((_, index) => slotCounts[index] >= threshold)

  if (activeSlots.length === 0) {
    const topIndex = slotCounts.indexOf(maxCount)
    return TIME_SLOTS[topIndex].label
  }

  return activeSlots.map((slot) => slot.label).join('、')
}

function aggregateLocations(observations: Observation[]): SpeciesLocationStat[] {
  const counter = new Map<string, number>()

  observations.forEach((obs) => {
    counter.set(obs.location_name, (counter.get(obs.location_name) || 0) + 1)
  })

  return Array.from(counter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function toPhotoWall(observations: Observation[]): SpeciesPhotoItem[] {
  return [...observations]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((obs) => ({
      obs_id: obs.obs_id,
      photo_url: obs.photo_url,
      time_text: formatRelativeTime(obs.submitted_at),
    }))
}

function toRelatedRecords(observations: Observation[]): SpeciesRelatedRecord[] {
  return [...observations]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((obs) => ({
      obs_id: obs.obs_id,
      photo_url: obs.photo_url,
      note: obs.note || '暂无描述',
      location_name: obs.location_name,
      time_text: formatRelativeTime(obs.submitted_at),
      like_count: obs.like_count,
    }))
}

function buildSummary(speciesName: string, observations: Observation[]): SpeciesArchiveSummary {
  const sorted = [...observations].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  )
  const locations = aggregateLocations(sorted)
  const isAnimal = isAnimalSpecies(speciesName)
  const activePeriods = isAnimal
    ? computeActivePeriods(sorted.map((obs) => obs.submitted_at))
    : ''

  return {
    species_name: speciesName,
    marker_label: getSpeciesMarkerLabel(speciesName),
    is_animal: isAnimal,
    record_count: sorted.length,
    cover_photo: sorted[0].photo_url,
    preview_photos: sorted.slice(0, 3).map((obs) => obs.photo_url),
    top_location: locations[0]?.name || '',
    active_periods: activePeriods,
    latest_time_text: formatRelativeTime(sorted[0].submitted_at),
  }
}

export function buildSpeciesArchiveSummaries(observations: Observation[]): SpeciesArchiveSummary[] {
  const groups = groupBySpecies(observations)

  return Array.from(groups.entries())
    .map(([speciesName, list]) => buildSummary(speciesName, list))
    .sort((a, b) => b.record_count - a.record_count)
}

export function buildSpeciesArchiveDetail(
  speciesName: string,
  observations: Observation[],
): SpeciesArchiveDetail | null {
  const groups = groupBySpecies(observations)
  const list = groups.get(speciesName.trim())
  if (!list || list.length === 0) return null

  const isAnimal = isAnimalSpecies(speciesName)

  return {
    species_name: speciesName,
    marker_label: getSpeciesMarkerLabel(speciesName),
    is_animal: isAnimal,
    record_count: list.length,
    photo_wall: toPhotoWall(list),
    common_locations: aggregateLocations(list),
    active_periods: isAnimal ? computeActivePeriods(list.map((obs) => obs.submitted_at)) : '',
    related_records: toRelatedRecords(list),
  }
}
