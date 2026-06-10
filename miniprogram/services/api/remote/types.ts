/** 后端 API 原始数据类型（camelCase，与接口文档一致） */

export interface RemoteUser {
  userId: number
  username: string | null
  email: string | null
  role: 'observer' | 'reviewer' | 'admin'
  status: 'active' | 'banned'
  nickname: string | null
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
}

export interface RemoteLocation {
  locationId: number
  name: string
  latitude: number | null
  longitude: number | null
  description: string | null
}

export interface RemoteSpecies {
  speciesId: number | null
  speciesName?: string | null
  description: string | null
  createdAt?: string
}

export interface RemotePhoto {
  photoId: number
  filePath: string
  previewPath: string
  uploadedAt: string
}

export interface RemoteObservation {
  obsId: number
  title: string
  content: string
  status: string
  submittedAt: string
  reviewedAt: string | null
  identifiedAt: string | null
  user: RemoteUser
  species: RemoteSpecies | null
  location: RemoteLocation
  photos: RemotePhoto[]
}

export interface RemotePost {
  postId: number
  observation: RemoteObservation | null
  viewCount: number
  priority: number
  status: string
  allowComment: boolean
  createdAt: string
  updatedAt: string
}

export interface RemoteIdentificationRequest {
  reqId: number
  observation: RemoteObservation
  status: 'pending' | 'identified' | 'rejected'
  reviewer: RemoteUser | null
  reqSpeciesName: string | null
  resultSpecies: RemoteSpecies | null
  reviewNote: string | null
}

export interface RemoteComment {
  commentId: number
  postId: number
  user: RemoteUser
  parentCommentId: number | null
  content: string
  status: string
  createdAt: string
  children?: RemoteComment[]
}

export interface RemoteNotification {
  notificationId: number
  user: RemoteUser
  type: string
  sourceUser: RemoteUser | null
  targetId: number | null
  content: string | null
  isRead: boolean
  createdAt: string
}

export interface RemoteAppeal {
  appealId: number
  postId: number
  user: RemoteUser
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer: RemoteUser | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  notificationId: number | null
}

export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
