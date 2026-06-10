import {
  getOwnerAppealForObs as localGetOwnerAppealForObs,
  submitObservationAppeal as localSubmitObservationAppeal,
  type SubmitAppealResult,
} from '../local/appeal-api'
import { USE_LOCAL_BACKEND } from './config'
import {
  getOwnerAppealForObsRemote,
  submitObservationAppealRemote,
} from './remote/appeal'

export type { SubmitAppealResult }

export function getOwnerAppealForObs(obsId: string, userId: string) {
  if (!USE_LOCAL_BACKEND) {
    return getOwnerAppealForObsRemote(obsId, userId)
  }
  return Promise.resolve(localGetOwnerAppealForObs(obsId, userId))
}

export function submitObservationAppeal(
  obsId: string,
  userId: string,
  reason: string,
): Promise<SubmitAppealResult> {
  if (!USE_LOCAL_BACKEND) {
    return submitObservationAppealRemote(obsId, userId, reason)
  }
  return Promise.resolve(localSubmitObservationAppeal(obsId, userId, reason))
}
