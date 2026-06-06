import { getLocalItem, setLocalItem } from './storage'

const LIKES_KEY = 'observation_likes'

interface LikeRecord {
  obs_id: string
  user_id: string
}

function getAllLikes(): LikeRecord[] {
  const stored = getLocalItem<LikeRecord[]>(LIKES_KEY)
  return Array.isArray(stored) ? stored : []
}

export function hasUserLiked(obsId: string, userId: string): boolean {
  return getAllLikes().some((item) => item.obs_id === obsId && item.user_id === userId)
}

/** 切换点赞，返回切换后是否已点赞 */
export function toggleUserLike(obsId: string, userId: string): boolean {
  const likes = getAllLikes()
  const index = likes.findIndex((item) => item.obs_id === obsId && item.user_id === userId)

  if (index >= 0) {
    likes.splice(index, 1)
    setLocalItem(LIKES_KEY, likes)
    return false
  }

  likes.push({ obs_id: obsId, user_id: userId })
  setLocalItem(LIKES_KEY, likes)
  return true
}
