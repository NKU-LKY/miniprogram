import { getUserProfile as localGetUserProfile, type UserProfileData } from '../local/profile-api'
import { USE_LOCAL_BACKEND } from './config'
import { getUserProfileRemote } from './remote/profile'

export type { UserProfileData }

export function getUserProfile(userId: string): Promise<UserProfileData | null> {
  if (!USE_LOCAL_BACKEND) {
    return getUserProfileRemote(userId)
  }
  return Promise.resolve(localGetUserProfile(userId))
}
