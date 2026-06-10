import type { ObservationCommentItem, ObservationCommentThreadItem } from '../../types/comment'
import type {
  CreateObservationParams,
  FeedListResult,
  MapObservationItem,
  ObservationDetailItem,
  ObservationFeedItem,
} from '../../types/observation'
import type { FilterOption, ObservationFilterParams } from '../../utils/observation-filter'
import {
  createObservationComment as localCreateObservationComment,
  listObservationCommentThreads as localListObservationCommentThreads,
  toggleObservationLike as localToggleObservationLike,
} from '../local/interaction-api'
import {
  createObservation as localCreateObservation,
  getFeedLocationOptions as localGetFeedLocationOptions,
  getFeedSpeciesOptions as localGetFeedSpeciesOptions,
  getMyLocationOptions as localGetMyLocationOptions,
  getMySpeciesOptions as localGetMySpeciesOptions,
  getObservationDetail as localGetObservationDetail,
  listFeed as localListFeed,
  listMapObservations as localListMapObservations,
  listMyFeed as localListMyFeed,
  setObservationCommentsEnabled as localSetObservationCommentsEnabled,
  withdrawObservation as localWithdrawObservation,
  type SetCommentsEnabledResult,
  type WithdrawObservationResult,
} from '../local/observation-api'
import { USE_LOCAL_BACKEND } from './config'
import {
  createObservationCommentRemote,
  listObservationCommentThreadsRemote,
  toggleCommentLikeRemote,
  toggleObservationLikeRemote,
} from './remote/interaction'
import {
  createObservationRemote,
  getFeedLocationOptionsRemote,
  getFeedSpeciesOptionsRemote,
  getMyLocationOptionsRemote,
  getMySpeciesOptionsRemote,
  getObservationDetailRemote,
  listFeedRemote,
  listMapObservationsRemote,
  listMyFeedRemote,
  setObservationCommentsEnabledRemote,
  withdrawObservationRemote,
} from './remote/observation'

export type { SetCommentsEnabledResult, WithdrawObservationResult }

export function listFeed(
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): Promise<FeedListResult> {
  if (!USE_LOCAL_BACKEND) {
    return listFeedRemote(page, pageSize, filter)
  }
  return Promise.resolve(localListFeed(page, pageSize, filter))
}

export function listMyFeed(
  userId: string,
  page: number,
  pageSize: number,
  filter?: ObservationFilterParams,
): Promise<FeedListResult> {
  if (!USE_LOCAL_BACKEND) {
    return listMyFeedRemote(userId, page, pageSize, filter)
  }
  return Promise.resolve(localListMyFeed(userId, page, pageSize, filter))
}

export function getObservationDetail(
  obsId: string,
  viewerUserId?: string,
): Promise<ObservationDetailItem | null> {
  if (!USE_LOCAL_BACKEND) {
    return getObservationDetailRemote(obsId, viewerUserId)
  }
  return Promise.resolve(localGetObservationDetail(obsId, viewerUserId))
}

export function withdrawObservation(
  obsId: string,
  userId: string,
): Promise<WithdrawObservationResult> {
  if (!USE_LOCAL_BACKEND) {
    return withdrawObservationRemote(obsId, userId)
  }
  return Promise.resolve(localWithdrawObservation(obsId, userId))
}

export function setObservationCommentsEnabled(
  obsId: string,
  userId: string,
  enabled: boolean,
): Promise<SetCommentsEnabledResult> {
  if (!USE_LOCAL_BACKEND) {
    return setObservationCommentsEnabledRemote(obsId, userId, enabled)
  }
  return Promise.resolve(localSetObservationCommentsEnabled(obsId, userId, enabled))
}

export function createObservation(params: CreateObservationParams): Promise<ObservationFeedItem> {
  if (!USE_LOCAL_BACKEND) {
    return createObservationRemote(params)
  }
  return Promise.resolve(localCreateObservation(params))
}

export function toggleObservationLike(
  obsId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  if (!USE_LOCAL_BACKEND) {
    return toggleObservationLikeRemote(obsId, userId)
  }
  return Promise.resolve(localToggleObservationLike(obsId, userId))
}

export function toggleCommentLike(
  commentId: string,
  userId: string,
  obsId?: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  if (!USE_LOCAL_BACKEND) {
    return toggleCommentLikeRemote(commentId, userId, obsId)
  }
  return Promise.resolve(null)
}

export function createObservationComment(
  obsId: string,
  userId: string,
  content: string,
  replyToCommentId?: string,
): Promise<{ comment: ObservationCommentItem; comment_count: number } | { error: string }> {
  if (!USE_LOCAL_BACKEND) {
    return createObservationCommentRemote(obsId, userId, content, replyToCommentId)
  }
  return Promise.resolve(localCreateObservationComment(obsId, userId, content, replyToCommentId))
}

export function listObservationCommentThreads(obsId: string): Promise<ObservationCommentThreadItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return listObservationCommentThreadsRemote(obsId)
  }
  return Promise.resolve(localListObservationCommentThreads(obsId))
}

export function getFeedSpeciesOptions(filter?: ObservationFilterParams): Promise<FilterOption[]> {
  if (!USE_LOCAL_BACKEND) {
    return getFeedSpeciesOptionsRemote()
  }
  return Promise.resolve(localGetFeedSpeciesOptions())
}

export function getFeedLocationOptions(filter?: ObservationFilterParams): Promise<FilterOption[]> {
  if (!USE_LOCAL_BACKEND) {
    return getFeedLocationOptionsRemote()
  }
  return Promise.resolve(localGetFeedLocationOptions())
}

export function getMySpeciesOptions(userId: string): Promise<FilterOption[]> {
  if (!USE_LOCAL_BACKEND) {
    return getMySpeciesOptionsRemote(userId)
  }
  return Promise.resolve(localGetMySpeciesOptions(userId))
}

export function getMyLocationOptions(userId: string): Promise<FilterOption[]> {
  if (!USE_LOCAL_BACKEND) {
    return getMyLocationOptionsRemote(userId)
  }
  return Promise.resolve(localGetMyLocationOptions(userId))
}

export function listMapObservations(filter?: ObservationFilterParams): Promise<MapObservationItem[]> {
  if (!USE_LOCAL_BACKEND) {
    return listMapObservationsRemote(filter)
  }
  return Promise.resolve(localListMapObservations(filter))
}
