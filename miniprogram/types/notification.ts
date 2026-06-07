/** 站内通知类型 */
export type NotificationType =
  | 'identification_result'
  | 'comment'
  | 'comment_reply'
  | 'observation_hidden'
  | 'appeal_received'
  | 'appeal_approved'
  | 'appeal_rejected'

/** 站内通知实体 */
export interface Notification {
  notification_id: string
  /** 接收通知的用户 */
  user_id: string
  type: NotificationType
  title: string
  content: string
  obs_id?: string
  comment_id?: string
  /** 触发通知的用户（审阅员、评论者等） */
  actor_user_id?: string
  is_read: boolean
  created_at: string
}

/** 个人中心通知展示项 */
export interface NotificationItem {
  notification_id: string
  type: NotificationType
  type_label: string
  type_icon: string
  title: string
  content: string
  obs_id?: string
  comment_id?: string
  is_read: boolean
  time_text: string
}
