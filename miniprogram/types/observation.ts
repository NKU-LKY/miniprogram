/** 观测记录状态 */
export type ObservationStatus =
  | 'approved'
  | 'needs_identification'
  | 'identified'
  | 'rejected'
  | 'pending_review'

/** 观测记录实体 */
export interface Observation {
  obs_id: string
  user_id: string
  species_name?: string
  location_name: string
  note: string
  status: ObservationStatus
  submitted_at: string
  photo_url: string
  like_count: number
  comment_count: number
}

/** 首页信息流卡片展示数据 */
export interface ObservationFeedItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name?: string
  status: ObservationStatus
  status_label?: string
  submitted_at: string
  time_text: string
  like_count: number
  comment_count: number
  publisher: {
    user_id: string
    nickname: string
    avatar_url: string
  }
}

export interface FeedListResult {
  list: ObservationFeedItem[]
  total: number
  hasMore: boolean
}

/** 提交新观测记录参数 */
export interface CreateObservationParams {
  user_id: string
  photo_url: string
  location_name: string
  note?: string
  species_name?: string
  needs_identification: boolean
}
