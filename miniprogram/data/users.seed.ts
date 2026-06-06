/**
 * 本地种子数据 —— 审阅员与管理员固定账号
 * 迁移至云服务器后端后，可删除整个 data/ 目录
 */
import type { User } from '../types/user'

/** 本地临时密码哈希（仅用于开发演示，生产环境使用 bcrypt） */
export const LOCAL_PASSWORDS = {
  reviewer: 'reviewer123',
  admin: 'admin123',
} as const

export const SEED_USERS: Omit<User, 'user_id' | 'created_at' | 'last_login_at'>[] = [
  {
    username: 'reviewer',
    role: 'reviewer',
    status: 'active',
    nickname: '校园审阅员',
    avatar_url: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    password_hash: 'LOCAL:reviewer123',
  },
  {
    username: 'admin',
    role: 'admin',
    status: 'active',
    nickname: '平台管理员',
    avatar_url: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    password_hash: 'LOCAL:admin123',
  },
  {
    role: 'observer',
    status: 'active',
    nickname: '小林同学',
    avatar_url: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    wechat_openid: 'wx_mock_demo_observer',
  },
]
