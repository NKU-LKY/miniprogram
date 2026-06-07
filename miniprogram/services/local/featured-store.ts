import { SEED_OBSERVATIONS } from '../../data/observations.seed'
import { getLocalItem, setLocalItem } from './storage'

const FEATURED_KEY = 'observation_featured'
const UNFEATURED_KEY = 'observation_featured_unfeatured'

function getSeedFeaturedIds(): string[] {
  return SEED_OBSERVATIONS.map((seed, index) => ({
    seed,
    obs_id: `obs_seed_${index + 1}`,
  }))
    .filter(({ seed }) => seed.is_featured === true)
    .map(({ obs_id }) => obs_id)
}

function readIdList(key: string): string[] {
  const stored = getLocalItem<string[]>(key)
  if (!Array.isArray(stored)) return []
  return stored
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim())
}

function writeIdList(key: string, ids: string[]): void {
  const next = Array.from(new Set(ids.map((id) => id.trim())))
  setLocalItem(key, JSON.parse(JSON.stringify(next)))
}

function readUnfeaturedOverrides(): Set<string> {
  return new Set(readIdList(UNFEATURED_KEY))
}

function addUnfeaturedOverride(obsId: string): void {
  const id = obsId.trim()
  const overrides = readIdList(UNFEATURED_KEY)
  if (overrides.includes(id)) return
  writeIdList(UNFEATURED_KEY, [...overrides, id])
}

function removeUnfeaturedOverride(obsId: string): void {
  const id = obsId.trim()
  writeIdList(
    UNFEATURED_KEY,
    readIdList(UNFEATURED_KEY).filter((item) => item !== id),
  )
}

/** 将种子数据中的精选记录写入精选列表（尊重管理员取消过的预设精选） */
export function syncSeedFeaturedIds(): void {
  const seedFeaturedIds = getSeedFeaturedIds()
  if (seedFeaturedIds.length === 0) return

  const current = new Set(readIdList(FEATURED_KEY))
  const unfeatured = readUnfeaturedOverrides()
  let changed = false

  seedFeaturedIds.forEach((id) => {
    if (unfeatured.has(id) || current.has(id)) return
    current.add(id)
    changed = true
  })

  if (changed) {
    writeIdList(FEATURED_KEY, Array.from(current))
  }
}

function readFeaturedIds(): string[] {
  syncSeedFeaturedIds()
  return readIdList(FEATURED_KEY)
}

export function isObservationFeatured(obsId: string): boolean {
  const id = obsId.trim()
  if (!id) return false
  return readFeaturedIds().includes(id)
}

export function setObservationFeatured(obsId: string, featured: boolean): boolean {
  const id = obsId.trim()
  if (!id) return false

  const ids = readFeaturedIds()
  const exists = ids.includes(id)

  if (featured === exists) return true

  if (featured) {
    writeIdList(FEATURED_KEY, [...ids, id])
    removeUnfeaturedOverride(id)
    return isObservationFeatured(id)
  }

  writeIdList(
    FEATURED_KEY,
    ids.filter((item) => item !== id),
  )
  if (getSeedFeaturedIds().includes(id)) {
    addUnfeaturedOverride(id)
  }
  return !isObservationFeatured(id)
}

export function listFeaturedObsIds(): string[] {
  return readFeaturedIds()
}
