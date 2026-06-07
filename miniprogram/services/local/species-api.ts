import type { SpeciesArchiveDetail, SpeciesArchiveSummary } from '../../types/species'
import { buildSpeciesArchiveDetail, buildSpeciesArchiveSummaries } from '../../utils/species-archive'
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
  return buildSpeciesArchiveDetail(name, getArchivableObservations())
}
