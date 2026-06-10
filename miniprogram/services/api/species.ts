import type { SpeciesArchiveDetail, SpeciesArchiveSummary } from '../../types/species'
import {
  getSpeciesArchive as localGetSpeciesArchive,
  listSpeciesArchives as localListSpeciesArchives,
} from '../local/species-api'
import { USE_LOCAL_BACKEND } from './config'
import { getSpeciesArchiveRemote, listSpeciesArchivesRemote } from './remote/species'

export function listSpeciesArchives(): Promise<SpeciesArchiveSummary[]> {
  if (!USE_LOCAL_BACKEND) {
    return listSpeciesArchivesRemote()
  }
  return Promise.resolve(localListSpeciesArchives())
}

export function getSpeciesArchive(speciesName: string): Promise<SpeciesArchiveDetail | null> {
  if (!USE_LOCAL_BACKEND) {
    return getSpeciesArchiveRemote(speciesName)
  }
  return Promise.resolve(localGetSpeciesArchive(speciesName))
}
