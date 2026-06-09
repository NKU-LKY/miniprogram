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

export type { IdentificationQueueItem, IdentificationResult }

export function listIdentificationQueue(reviewerId: string): Promise<IdentificationQueueItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程鉴定队列 API 待实现'))
  }
  return Promise.resolve(localListIdentificationQueue(reviewerId))
}

export function countPendingIdentification(): Promise<number> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程鉴定队列 API 待实现'))
  }
  return Promise.resolve(localCountPendingIdentification())
}

export function claimIdentification(obsId: string, reviewerId: string): Promise<IdentificationResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程认领鉴定 API 待实现'))
  }
  return Promise.resolve(localClaimIdentification(obsId, reviewerId))
}

export function releaseIdentification(obsId: string, reviewerId: string): Promise<IdentificationResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程释放认领 API 待实现'))
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
    return Promise.reject(new Error('远程完成鉴定 API 待实现'))
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
    return Promise.reject(new Error('远程鉴定状态 API 待实现'))
  }
  return Promise.resolve(localGetIdentificationState(obsId, reviewerId))
}
