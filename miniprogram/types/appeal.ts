/** 申诉状态 */
export type AppealStatus = 'pending' | 'approved' | 'rejected'

/** 观测记录隐藏申诉 */
export interface Appeal {
  appeal_id: string
  obs_id: string
  user_id: string
  reason: string
  status: AppealStatus
  created_at: string
  resolved_at?: string
  resolved_by?: string
}

/** 详情页申诉展示状态 */
export interface OwnerAppealView {
  appeal_id: string
  status: AppealStatus
  reason: string
  status_label: string
  time_text: string
}

/** 管理员申诉列表项 */
export interface ModerationAppealItem {
  appeal_id: string
  obs_id: string
  appellant_user_id: string
  photo_url: string
  obs_note: string
  reason: string
  appellant_nickname: string
  time_text: string
}
