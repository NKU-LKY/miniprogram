import type { ObservationCommentThreadItem } from './comment'

/** 观测记录状态 */
export type ObservationStatus =
  | 'approved'
  | 'needs_identification'
  | 'identified'
  | 'rejected'
  | 'pending_review'
  | 'withdrawn'

/** 观测记录实体 */
export interface Observation {
  obs_id: string
  user_id: string
  species_name?: string
  location_name: string
  /** 用户补充的详细地址备注（选填） */
  location_detail?: string
  /** 地图选点的实际纬度（gcj02） */
  latitude?: number
  /** 地图选点的实际经度（gcj02） */
  longitude?: number
  note: string
  status: ObservationStatus
  submitted_at: string
  photo_url: string
  like_count: number
  comment_count: number
  /** 管理员标记的精选记录 */
  is_featured?: boolean
  /** 认领该鉴定的审阅员 */
  reviewer_id?: string
  /** 认领时间 */
  claimed_at?: string
  /** 鉴定完成时间 */
  identified_at?: string
  /** 鉴定备注 */
  review_note?: string
  /** 评论区是否开放，默认 true */
  comments_enabled?: boolean
}

/** 首页信息流卡片展示数据 */
export interface ObservationFeedItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  location_detail?: string
  species_name?: string
  status: ObservationStatus
  status_label?: string
  submitted_at: string
  time_text: string
  like_count: number
  comment_count: number
  is_featured: boolean
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

/** 观测记录详情页展示数据 */
export interface ObservationDetailItem extends ObservationFeedItem {
  time_full: string
  liked: boolean
  comments_enabled: boolean
  comments: ObservationCommentThreadItem[]
}

/** 提交新观测记录参数 */
export interface CreateObservationParams {
  user_id: string
  photo_url: string
  location_name: string
  location_detail?: string
  latitude?: number
  longitude?: number
  note?: string
  species_name?: string
  needs_identification: boolean
}

/** 地图页观测标记 */
export interface MapObservationItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name?: string
  latitude: number
  longitude: number
  /** 地图聚合用的地点键（预设地标名或独立坐标） */
  location_key: string
  marker_label: string
  submitted_at: string
  time_text: string
}

/** 地图页某地点的物种汇总 */
export interface MapLocationSpeciesSummary {
  name: string
  count: number
  marker_label: string
}

/** 地图页按位置聚合后的地点信息 */
export interface MapLocationGroup {
  location_key: string
  location_name: string
  latitude: number
  longitude: number
  record_count: number
  species_list: MapLocationSpeciesSummary[]
  records: MapObservationItem[]
  marker_label: string
}
