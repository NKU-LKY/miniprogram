import { CAMPUS_LOCATIONS } from '../data/locations'
import { SEED_SPECIES_NAMES } from '../data/observations.seed'
import { normalizeMapLocation } from './map-locations'

export interface FilterOption {
  label: string
  value: string
}

export interface TimeFilterOption {
  label: string
  value: string
}

export interface ObservationFilterParams {
  species?: string
  location?: string
  timeRange?: string
  featuredOnly?: boolean
  keyword?: string
}

export const SPECIES_UNIDENTIFIED_VALUE = '__unidentified__'
export const SPECIES_OTHER_VALUE = '__species_other__'
export const LOCATION_OTHER_VALUE = '__location_other__'

export const TIME_RANGE_OPTIONS: TimeFilterOption[] = [
  { label: '全部时间', value: 'all' },
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '近3个月', value: '90d' },
]

const TIME_RANGE_DAYS: { [key: string]: number } = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

interface FilterableObservation {
  species_name?: string
  location_name: string
  location_detail?: string
  note?: string
  latitude?: number | string
  longitude?: number | string
  submitted_at: string
}

function getSpeciesName(obs: FilterableObservation): string {
  return obs.species_name ? obs.species_name.trim() : ''
}

const SEED_SPECIES_SET = new Set(SEED_SPECIES_NAMES)

export function collectSpeciesOptions(observations: FilterableObservation[]): FilterOption[] {
  const options: FilterOption[] = [{ label: '全部物种', value: '' }]
  const nameMap: { [key: string]: boolean } = {}
  let hasUnidentified = false

  for (let i = 0; i < observations.length; i++) {
    const name = getSpeciesName(observations[i])
    if (name) {
      nameMap[name] = true
    } else {
      hasUnidentified = true
    }
  }

  if (hasUnidentified) {
    options.push({ label: '待鉴定', value: SPECIES_UNIDENTIFIED_VALUE })
  }

  const names = Object.keys(nameMap).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  for (let j = 0; j < names.length; j++) {
    options.push({ label: names[j], value: names[j] })
  }

  options.push({ label: '其他', value: SPECIES_OTHER_VALUE })
  return options
}

export function collectLocationOptions(_observations: FilterableObservation[]): FilterOption[] {
  const options: FilterOption[] = [{ label: '全部地点', value: '' }]

  CAMPUS_LOCATIONS.forEach((name) => {
    options.push({ label: name, value: name })
  })

  options.push({ label: '其他', value: LOCATION_OTHER_VALUE })
  return options
}

export function buildFilterParams(
  speciesOption: FilterOption,
  timeOption: TimeFilterOption,
  featuredOnly?: boolean,
  locationOption?: FilterOption,
  keyword?: string,
): ObservationFilterParams {
  const trimmedKeyword = keyword ? keyword.trim() : ''
  return {
    species: speciesOption.value,
    location: locationOption && locationOption.value ? locationOption.value : undefined,
    timeRange: timeOption.value,
    featuredOnly: featuredOnly || undefined,
    keyword: trimmedKeyword || undefined,
  }
}

export function isFilterActive(
  speciesIndex: number,
  timeIndex: number,
  featuredOnly?: boolean,
  locationIndex?: number,
  keyword?: string,
): boolean {
  return (
    speciesIndex > 0 ||
    timeIndex > 0 ||
    Boolean(featuredOnly) ||
    (locationIndex !== undefined && locationIndex > 0) ||
    Boolean(keyword && keyword.trim())
  )
}

function matchesSpecies(obs: FilterableObservation, species?: string): boolean {
  if (!species) return true
  const speciesName = getSpeciesName(obs)
  if (species === SPECIES_UNIDENTIFIED_VALUE) return !speciesName
  if (species === SPECIES_OTHER_VALUE) {
    return Boolean(speciesName) && !SEED_SPECIES_SET.has(speciesName)
  }
  return speciesName === species
}

function matchesLocation(obs: FilterableObservation, location?: string): boolean {
  if (!location) return true

  const normalized = normalizeMapLocation(obs)
  if (location === LOCATION_OTHER_VALUE) {
    return Boolean(normalized && normalized.location_key.startsWith('coord:'))
  }

  if (!normalized) return false
  return normalized.location_key === `preset:${location}`
}

function matchesTimeRange(submittedAt: string, timeRange?: string): boolean {
  if (!timeRange || timeRange === 'all') return true
  const days = TIME_RANGE_DAYS[timeRange]
  if (!days) return true
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(submittedAt).getTime() >= cutoff
}

function matchesKeyword(obs: FilterableObservation, keyword?: string): boolean {
  if (!keyword) return true
  const query = keyword.trim().toLowerCase()
  if (!query) return true

  const fields = [obs.note, obs.species_name, obs.location_name, obs.location_detail]
  for (let i = 0; i < fields.length; i++) {
    const value = fields[i]
    if (value && value.toLowerCase().includes(query)) return true
  }
  return false
}

export function applyObservationFilter(
  observations: FilterableObservation[],
  filter?: ObservationFilterParams,
): FilterableObservation[] {
  if (!filter) return observations

  const result: FilterableObservation[] = []
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i]
    if (
      matchesSpecies(obs, filter.species) &&
      matchesLocation(obs, filter.location) &&
      matchesTimeRange(obs.submitted_at, filter.timeRange) &&
      matchesKeyword(obs, filter.keyword)
    ) {
      result.push(obs)
    }
  }
  return result
}
