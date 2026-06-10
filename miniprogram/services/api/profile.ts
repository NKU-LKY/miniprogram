import type { SafeUser } from '../../types/user'
import { getUserProfile as localGetUserProfile, type UserProfileData } from '../local/profile-api'
import { USE_LOCAL_BACKEND } from './config'
import { getUserProfileRemote } from './remote/profile'

export type { UserProfileData }

export function getUserProfile(userId: string, sessionUser?: SafeUser | null): Promise<UserProfileData> {
  if (!USE_LOCAL_BACKEND) {
    if (!sessionUser) {
      return Promise.reject(new Error('未登录'))
    }
    return getUserProfileRemote(userId, sessionUser)
  }
  const profile = localGetUserProfile(userId)
  if (!profile) {
    return Promise.reject(new Error('用户不存在'))
  }
  return Promise.resolve(profile)
}
