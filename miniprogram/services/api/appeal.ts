import {
  getOwnerAppealForObs as localGetOwnerAppealForObs,
  submitObservationAppeal as localSubmitObservationAppeal,
  type SubmitAppealResult,
} from '../local/appeal-api'
import { USE_LOCAL_BACKEND } from './config'

export type { SubmitAppealResult }

export function getOwnerAppealForObs(obsId: string, userId: string) {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程申诉 API 待实现')
  }
  return localGetOwnerAppealForObs(obsId, userId)
}

export function submitObservationAppeal(
  obsId: string,
  userId: string,
  reason: string,
): SubmitAppealResult {
  if (!USE_LOCAL_BACKEND) {
    throw new Error('远程申诉 API 待实现')
  }
  return localSubmitObservationAppeal(obsId, userId, reason)
}
