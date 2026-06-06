import type { CreateObservationParams, FeedListResult, ObservationFeedItem } from '../../types/observation'
import {
  createObservation as localCreateObservation,
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

export function createObservation(params: CreateObservationParams): Promise<ObservationFeedItem> {
  if (!USE_LOCAL_BACKEND) {
    return Promise.reject(new Error('远程创建观测 API 待实现'))
  }
  return Promise.resolve(localCreateObservation(params))
}
