import { isValidSpeciesCategory } from '../../data/species-categories'
import type { SpeciesArchiveDetail, SpeciesArchiveSummary } from '../../types/species'
import { buildSpeciesArchiveDetail, buildSpeciesArchiveSummaries } from '../../utils/species-archive'
import { resolveSpeciesArchiveKey } from '../../utils/species-migration'
import { getAllObservations } from './observation-store'

function getArchivableObservations() {
  return getAllObservations().filter(
    (obs) =>
      obs.species_name &&
      obs.species_name.trim() &&
      obs.status !== 'rejected' &&
      obs.status !== 'pending_review' &&
      obs.status !== 'withdrawn',
  )
}

export function listSpeciesArchives(): SpeciesArchiveSummary[] {
  return buildSpeciesArchiveSummaries(getArchivableObservations())
}

export function getSpeciesArchive(speciesName: string): SpeciesArchiveDetail | null {
  const name = speciesName.trim()
  if (!name) return null

  const categoryKey = isValidSpeciesCategory(name) ? name : resolveSpeciesArchiveKey(name)
  if (!categoryKey) return null

  return buildSpeciesArchiveDetail(categoryKey, getArchivableObservations())
}
