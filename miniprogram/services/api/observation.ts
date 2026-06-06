import type { ObservationCommentItem } from '../../types/comment'
import type {
  CreateObservationParams,
  FeedListResult,
  ObservationDetailItem,
  ObservationFeedItem,
} from '../../types/observation'
import {
  createObservationComment as localCreateObservationComment,
  toggleObservationLike as localToggleObservationLike,
} from '../local/interaction-api'
import {
  createObservation as localCreateObservation,
  getObservationDetail as localGetObservationDetail,
  listFeed as localListFeed,
  listMyFeed as localListMyFeed,
} from '../local/observation-api'
import { USE_LOCAL_BACKEND } from './config'

export function listFeed(page: number, pageSize: number): Promise<FeedListResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程观测列表 API 待实现'))
  }
  return Promise.resolve(localListFeed(page, pageSize))
}

export function listMyFeed(userId: string, page: number, pageSize: number): Promise<FeedListResult> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程我的观测列表 API 待实现'))
  }
  return Promise.resolve(localListMyFeed(userId, page, pageSize))
}

export function getObservationDetail(
  obsId: string,
  viewerUserId?: string,
): Promise<ObservationDetailItem | null> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程观测详情 API 待实现'))
  }
  return Promise.resolve(localGetObservationDetail(obsId, viewerUserId))
}

export function createObservation(params: CreateObservationParams): Promise<ObservationFeedItem> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程创建观测 API 待实现'))
  }
  return Promise.resolve(localCreateObservation(params))
}

export function toggleObservationLike(
  obsId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number } | null> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程点赞 API 待实现'))
  }
  return Promise.resolve(localToggleObservationLike(obsId, userId))
}

export function createObservationComment(
  obsId: string,
  userId: string,
  content: string,
): Promise<{ comment: ObservationCommentItem; comment_count: number } | { error: string }> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程评论 API 待实现'))
  }
  return Promise.resolve(localCreateObservationComment(obsId, userId, content))
}
