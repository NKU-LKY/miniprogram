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
  timeRange?: string
  featuredOnly?: boolean
}

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
  submitted_at: string
}

function getSpeciesName(obs: FilterableObservation): string {
  return obs.species_name ? obs.species_name.trim() : ''
}

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
    options.push({ label: '待鉴定', value: '__unidentified__' })
  }

  const names = Object.keys(nameMap).sort()
  for (let j = 0; j < names.length; j++) {
    options.push({ label: names[j], value: names[j] })
  }

  return options
}

export function buildFilterParams(
  speciesOption: FilterOption,
  timeOption: TimeFilterOption,
  featuredOnly?: boolean,
): ObservationFilterParams {
  return {
    species: speciesOption.value,
    timeRange: timeOption.value,
    featuredOnly: featuredOnly || undefined,
  }
}

export function isFilterActive(
  speciesIndex: number,
  timeIndex: number,
  featuredOnly?: boolean,
): boolean {
  return speciesIndex > 0 || timeIndex > 0 || Boolean(featuredOnly)
}

function matchesSpecies(obs: FilterableObservation, species?: string): boolean {
  if (!species) return true
  const speciesName = getSpeciesName(obs)
  if (species === '__unidentified__') return !speciesName
  return speciesName === species
}

function matchesTimeRange(submittedAt: string, timeRange?: string): boolean {
  if (!timeRange || timeRange === 'all') return true
  const days = TIME_RANGE_DAYS[timeRange]
  if (!days) return true
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(submittedAt).getTime() >= cutoff
}

export function applyObservationFilter(
  observations: FilterableObservation[],
  filter?: ObservationFilterParams,
): FilterableObservation[] {
  if (!filter) return observations

  const result: FilterableObservation[] = []
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i]
    if (matchesSpecies(obs, filter.species) && matchesTimeRange(obs.submitted_at, filter.timeRange)) {
      result.push(obs)
    }
  }
  return result
}
