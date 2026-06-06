/** 用户角色 */
export type UserRole = 'observer' | 'reviewer' | 'admin'

/** 账号状态 */
export type UserStatus = 'active' | 'banned'

/** 用户实体（与需求文档 User 表对应） */
export interface User {
  user_id: string
  username?: string
  email?: string
  password_hash?: string
  wechat_openid?: string
  role: UserRole
  status: UserStatus
  nickname: string
  avatar_url: string
  created_at: string
  last_login_at: string
}

/** 登录成功后返回给前端的用户信息（不含敏感字段） */
export type SafeUser = Omit<User, 'password_hash'>

/** 观测者注册参数 */
export interface ObserverRegisterParams {
  nickname: string
  avatar_url: string
}

/** 审阅员/管理员登录参数 */
export interface StaffLoginParams {
  username: string
  password: string
  role: 'reviewer' | 'admin'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  observer: '观测者/贡献者',
  reviewer: '审阅员',
  admin: '管理员',
}
