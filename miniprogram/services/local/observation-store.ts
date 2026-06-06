import { SEED_OBSERVATIONS } from '../../data/observations.seed'
import type { Observation } from '../../types/observation'
import { getLocalItem, setLocalItem } from './storage'

const OBSERVATIONS_KEY = 'observations'

export function buildSeedObservations(): Observation[] {
  return SEED_OBSERVATIONS.map((seed, index) => ({
    ...seed,
    obs_id: `obs_seed_${index + 1}`,
  }))
}

export function getAllObservations(): Observation[] {
  const seed = buildSeedObservations()
  const stored = getLocalItem<Observation[]>(OBSERVATIONS_KEY)

  if (Array.isArray(stored) && stored.length >= seed.length) {
    return stored
  }

  setLocalItem(OBSERVATIONS_KEY, seed)
  return seed
}

function generateObsId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addObservation(
  input: Omit<Observation, 'obs_id' | 'like_count' | 'comment_count' | 'submitted_at'>,
): Observation {
  const observation: Observation = {
    ...input,
    obs_id: generateObsId(),
    like_count: 0,
    comment_count: 0,
    submitted_at: new Date().toISOString(),
  }

  const all = getAllObservations()
  setLocalItem(OBSERVATIONS_KEY, [observation, ...all])
  return observation
}
