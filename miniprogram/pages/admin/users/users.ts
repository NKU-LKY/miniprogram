import {
  listUsersForAdmin,
  setUserBanForAdmin,
  setUserRoleForAdmin,
} from '../../../services/api/admin'
import type { AdminUserListItem, UserRole } from '../../../types/user'
import { ROLE_LABELS } from '../../../types/user'
import { ASSIGNABLE_ROLES } from '../../../utils/permissions'
import { getCurrentUser } from '../../../utils/session'

Page({
  data: {
    loading: true,
    userList: [] as AdminUserListItem[],
    forbidden: false,
  },

  onShow() {
    const current = getCurrentUser()
    if (!current || current.role !== 'admin') {
      this.setData({ loading: false, forbidden: true })
      return
    }
    this.loadUsers()
  },

  loadUsers() {
    this.setData({ loading: true, forbidden: false })

    listUsersForAdmin()
      .then((result) => {
        if ('error' in result) {
          this.setData({ loading: false, forbidden: true })
          return
        }
        this.setData({ userList: result, loading: false })
      })
      .catch((err) => {
        console.error('loadUsers error:', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
      })
  },

  onChangeRole(e: WechatMiniprogram.TouchEvent) {
    const userId = e.currentTarget.dataset.id as string
    const user = this.data.userList.find((item) => item.user_id === userId)
    if (!user || user.is_self) return

    const itemList = ASSIGNABLE_ROLES.map((role) => ROLE_LABELS[role])
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const role = ASSIGNABLE_ROLES[res.tapIndex]
        if (!role || role === user.role) return

        wx.showModal({
          title: '切换角色',
          content: `将「${user.nickname}」的角色改为「${ROLE_LABELS[role]}」？`,
          confirmColor: '#4c8c4a',
          success: (modal) => {
            if (!modal.confirm) return
            setUserRoleForAdmin(userId, role as UserRole).then((result) => {
              if (!result.success) {
                wx.showToast({ title: result.message || '操作失败', icon: 'none' })
                return
              }
              wx.showToast({ title: '角色已更新', icon: 'success' })
              this.loadUsers()
            })
          },
        })
      },
    })
  },

  onToggleBan(e: WechatMiniprogram.TouchEvent) {
    const userId = e.currentTarget.dataset.id as string
    const user = this.data.userList.find((item) => item.user_id === userId)
    if (!user || user.is_self) return

    const banned = user.status === 'active'
    wx.showModal({
      title: banned ? '封禁用户' : '解除封禁',
      content: banned
        ? `确定封禁「${user.nickname}」？封禁后该用户将无法登录。`
        : `确定解除「${user.nickname}」的封禁？`,
      confirmColor: banned ? '#c45c5c' : '#4c8c4a',
      success: (res) => {
        if (!res.confirm) return
        setUserBanForAdmin(userId, banned).then((result) => {
          if (!result.success) {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' })
            return
          }
          wx.showToast({ title: banned ? '已封禁' : '已解封', icon: 'success' })
          this.loadUsers()
        })
      },
    })
  },
})
