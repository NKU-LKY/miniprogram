import {
  claimIdentification as localClaimIdentification,
  completeIdentification as localCompleteIdentification,
  countPendingIdentification as localCountPendingIdentification,
  getIdentificationState as localGetIdentificationState,
  listIdentificationQueue as localListIdentificationQueue,
  releaseIdentification as localReleaseIdentification,
  type IdentificationQueueItem,
  type IdentificationResult,
} from '../local/identification-api'
import { USE_LOCAL_BACKEND } from './config'
import {
  claimIdentificationRemote,
  completeIdentificationRemote,
  countPendingIdentificationRemote,
  getIdentificationStateRemote,
  listIdentificationQueueRemote,
  releaseIdentificationRemote,
} from './remote/identification'

export type { IdentificationQueueItem, IdentificationResult }

export function listIdentificationQueue(reviewerId: string): Promise<IdentificationQueueItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return listIdentificationQueueRemote(reviewerId)
  }
  return Promise.resolve(localListIdentificationQueue(reviewerId))
}

export function countPendingIdentification(): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return countPendingIdentificationRemote()
  }
  return Promise.resolve(localCountPendingIdentification())
}

export function claimIdentification(obsId: string, reviewerId: string): Promise<IdentificationResult> {
  if (!USE_LOCAL_BACKEND) {
    return claimIdentificationRemote(obsId, reviewerId)
  }
  return Promise.resolve(localClaimIdentification(obsId, reviewerId))
}

export function releaseIdentification(obsId: string, reviewerId: string): Promise<IdentificationResult> {
  if (!USE_LOCAL_BACKEND) {
    return releaseIdentificationRemote(obsId, reviewerId)
  }
  return Promise.resolve(localReleaseIdentification(obsId, reviewerId))
}

export function completeIdentification(
  obsId: string,
  reviewerId: string,
  categoryName: string,
  speciesRemark?: string,
  reviewNote?: string,
): Promise<IdentificationResult> {
  if (!USE_LOCAL_BACKEND) {
    return completeIdentificationRemote(obsId, reviewerId, categoryName, speciesRemark, reviewNote)
  }
  return Promise.resolve(
    localCompleteIdentification(obsId, reviewerId, categoryName, speciesRemark, reviewNote),
  )
}

export function getIdentificationState(
  obsId: string,
  reviewerId: string,
): Promise<ReturnType<typeof localGetIdentificationState>> {
  if (!USE_LOCAL_BACKEND) {
    return getIdentificationStateRemote(obsId, reviewerId)
  }
  return Promise.resolve(localGetIdentificationState(obsId, reviewerId))
}
