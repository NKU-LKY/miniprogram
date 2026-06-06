/** 评论实体 */
export interface ObservationComment {
  comment_id: string
  obs_id: string
  user_id: string
  content: string
  created_at: string
  status: 'active' | 'deleted'
}

/** 详情页评论展示项 */
export interface ObservationCommentItem {
  comment_id: string
  content: string
  time_text: string
  author_nickname: string
  author_avatar_url: string
  is_expert: boolean
}
