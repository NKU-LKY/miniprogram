import type { SpeciesArchiveDetail, SpeciesArchiveSummary } from '../../types/species'
import {
  getSpeciesArchive as localGetSpeciesArchive,
  listSpeciesArchives as localListSpeciesArchives,
} from '../local/species-api'
import { USE_LOCAL_BACKEND } from './config'

export function listSpeciesArchives(): Promise<SpeciesArchiveSummary[]> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程物种档案 API 待实现'))
  }
  return Promise.resolve(localListSpeciesArchives())
}

export function getSpeciesArchive(speciesName: string): Promise<SpeciesArchiveDetail | null> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程物种档案 API 待实现'))
  }
  return Promise.resolve(localGetSpeciesArchive(speciesName))
}
