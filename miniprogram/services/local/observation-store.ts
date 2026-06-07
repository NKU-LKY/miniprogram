import { SEED_OBSERVATIONS } from '../../data/observations.seed'
import type { Observation } from '../../types/observation'
import { getLocalItem, setLocalItem } from './storage'

const OBSERVATIONS_KEY = 'observations'
const SEED_VERSION_KEY = 'observations_seed_version'
const CURRENT_SEED_VERSION = 2

function normalizeObservation(obs: Observation): Observation {
  return { ...obs }
}

function cloneObservations(list: Observation[]): Observation[] {
  return list.map(normalizeObservation)
}

function saveObservations(list: Observation[]): Observation[] {
  const normalized = cloneObservations(list)
  setLocalItem(OBSERVATIONS_KEY, normalized)
  return normalized
}

export function buildSeedObservations(): Observation[] {
  return SEED_OBSERVATIONS.map((seed, index) =>
    normalizeObservation({
      ...seed,
      obs_id: `obs_seed_${index + 1}`,
      is_featured: seed.is_featured === true,
    }),
  )
}

function mergeSeedIntoStored(
  stored: Observation[],
  seed: Observation[],
  refreshSeed = false,
): Observation[] {
  const merged = cloneObservations(stored)
  const seedMap = new Map(seed.map((obs) => [obs.obs_id, obs]))

  if (refreshSeed) {
    merged.forEach((obs, index) => {
      const seedObs = seedMap.get(obs.obs_id)
      if (!seedObs) return
      merged[index] = normalizeObservation({
        ...seedObs,
        like_count: obs.like_count,
        comment_count: obs.comment_count,
        is_featured: obs.is_featured,
      })
    })
  }

  const existingIds = new Set(merged.map((obs) => obs.obs_id))
  seed.forEach((seedObs) => {
    if (!existingIds.has(seedObs.obs_id)) {
      merged.push(seedObs)
    }
  })

  return merged
}

export function getAllObservations(): Observation[] {
  const seed = buildSeedObservations()
  const stored = getLocalItem<Observation[]>(OBSERVATIONS_KEY)
  const seedVersion = getLocalItem<number>(SEED_VERSION_KEY)

  if (!Array.isArray(stored) || stored.length === 0) {
    setLocalItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
    return saveObservations(seed)
  }

  const seedOutdated = seedVersion !== CURRENT_SEED_VERSION
  const merged = mergeSeedIntoStored(stored, seed, seedOutdated)
  const storedIds = new Set(stored.map((obs) => obs.obs_id))
  const hasMissingSeed = seed.some((obs) => !storedIds.has(obs.obs_id))

  if (hasMissingSeed || merged.length !== stored.length || seedOutdated) {
    setLocalItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
    return saveObservations(merged)
  }

  return cloneObservations(stored)
}

function generateObsId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addObservation(
  input: Omit<Observation, 'obs_id' | 'like_count' | 'comment_count' | 'submitted_at'>,
): Observation {
  const observation = normalizeObservation({
    ...input,
    obs_id: generateObsId(),
    like_count: 0,
    comment_count: 0,
    is_featured: false,
    submitted_at: new Date().toISOString(),
  })

  const all = getAllObservations()
  saveObservations([observation, ...all])
  return observation
}

export function updateObservation(
  obsId: string,
  patch: Partial<
    Pick<
      Observation,
      | 'like_count'
      | 'comment_count'
      | 'status'
      | 'species_name'
      | 'reviewer_id'
      | 'claimed_at'
      | 'identified_at'
      | 'review_note'
    >
  >,
): Observation | null {
  const trimmedId = obsId.trim()
  const all = getAllObservations()
  const index = all.findIndex((obs) => obs.obs_id === trimmedId)
  if (index < 0) return null

  const updated = normalizeObservation({ ...all[index], ...patch })
  all[index] = updated
  saveObservations(all)
  return updated
}

export type WithdrawStoreResult =
  | { ok: true; observation: Observation }
  | { ok: false; reason: 'invalid' | 'not_found' | 'not_owner' | 'already_withdrawn' }

export function withdrawObservationByOwner(
  obsId: string,
  userId: string,
): WithdrawStoreResult {
  const trimmedId = obsId.trim()
  const trimmedUserId = userId.trim()
  if (!trimmedId || !trimmedUserId) {
    return { ok: false, reason: 'invalid' }
  }

  const all = getAllObservations()
  const index = all.findIndex((obs) => obs.obs_id === trimmedId)
  if (index < 0) {
    return { ok: false, reason: 'not_found' }
  }

  const target = all[index]
  if (target.user_id !== trimmedUserId) {
    return { ok: false, reason: 'not_owner' }
  }
  if (target.status === 'withdrawn') {
    return { ok: false, reason: 'already_withdrawn' }
  }

  const updated = normalizeObservation({
    ...target,
    status: 'withdrawn',
    reviewer_id: undefined,
    claimed_at: undefined,
  })
  all[index] = updated
  saveObservations(all)
  return { ok: true, observation: updated }
}
