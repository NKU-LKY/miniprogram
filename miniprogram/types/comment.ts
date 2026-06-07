/** 评论实体 */
export interface ObservationComment {
  comment_id: string
  obs_id: string
  user_id: string
  content: string
  created_at: string
  status: 'active' | 'deleted'
  /** 被回复的评论 ID */
  reply_to_comment_id?: string
  /** 被回复的用户 ID */
  reply_to_user_id?: string
  /** 所属的一级评论 ID（仅二级回复有值） */
  parent_comment_id?: string
}

/** 详情页评论展示项（扁平，兼容旧逻辑） */
export interface ObservationCommentItem {
  comment_id: string
  content: string
  time_text: string
  author_nickname: string
  author_avatar_url: string
  is_expert: boolean
  reply_to_nickname?: string
}

/** 二级回复展示项 */
export interface ObservationCommentReplyItem extends ObservationCommentItem {}

/** 一级评论及其回复 */
export interface ObservationCommentThreadItem extends ObservationCommentItem {
  replies: ObservationCommentReplyItem[]
}
