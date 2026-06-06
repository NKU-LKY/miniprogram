import type { Observation } from '../types/observation'

export type TimeRangeKey = 'all' | '7d' | '30d' | '90d'

export interface FilterOption {
  label: string
  value: string
}

export interface TimeFilterOption {
  label: string
  value: TimeRangeKey
}

export interface ObservationFilterParams {
  species?: string
  timeRange?: TimeRangeKey
}

export const TIME_RANGE_OPTIONS: TimeFilterOption[] = [
  { label: '全部时间', value: 'all' },
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '近3个月', value: '90d' },
]

const TIME_RANGE_DAYS: Record<Exclude<TimeRangeKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export function collectSpeciesOptions(observations: Observation[]): FilterOption[] {
  const options: FilterOption[] = [{ label: '全部物种', value: '' }]
  const names = new Set<string>()
  let hasUnidentified = false

  for (const obs of observations) {
    const name = obs.species_name?.trim()
    if (name) {
      names.add(name)
    } else {
      hasUnidentified = true
    }
  }

  if (hasUnidentified) {
    options.push({ label: '待鉴定', value: '__unidentified__' })
  }

  for (const name of Array.from(names).sort()) {
    options.push({ label: name, value: name })
  }

  return options
}

export function buildFilterParams(
  speciesOption: FilterOption,
  timeOption: TimeFilterOption,
): ObservationFilterParams {
  return {
    species: speciesOption.value,
    timeRange: timeOption.value,
  }
}

export function isFilterActive(
  speciesIndex: number,
  timeIndex: number,
): boolean {
  return speciesIndex > 0 || timeIndex > 0
}

function matchesSpecies(obs: Observation, species?: string): boolean {
  if (!species) return true
  if (species === '__unidentified__') return !obs.species_name?.trim()
  return obs.species_name?.trim() === species
}

function matchesTimeRange(submittedAt: string, timeRange?: TimeRangeKey): boolean {
  if (!timeRange || timeRange === 'all') return true
  const days = TIME_RANGE_DAYS[timeRange]
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(submittedAt).getTime() >= cutoff
}

export function applyObservationFilter<T extends Observation>(
  observations: T[],
  filter?: ObservationFilterParams,
): T[] {
  if (!filter) return observations

  return observations.filter(
    (obs) =>
      matchesSpecies(obs, filter.species) &&
      matchesTimeRange(obs.submitted_at, filter.timeRange),
  )
}
