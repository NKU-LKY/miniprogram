import { loginObserver, loginStaff } from '../../services/api/auth'
import { setSession } from '../../utils/session'
import type { UserRole } from '../../types/user'

import { getCurrentUser } from '../../utils/session'

Page({
  data: {
    activeRole: 'observer' as UserRole,
    username: '',
    password: '',
    loading: false,
  },

  onLoad() {
    if (getCurrentUser()) {
      wx.redirectTo({ url: '/pages/index/index' })
    }
  },

  onRoleChange(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as UserRole
    this.setData({
      activeRole: role,
      username: '',
      password: '',
    })
  },

  onUsernameInput(e: WechatMiniprogram.Input) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ password: e.detail.value })
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' })
  },

  async onObserverLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const result = await loginObserver()
      if (!result.success || !result.user) {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' })
        if (result.message && /尚未注册|请先注册|不存在/.test(result.message)) {
          setTimeout(() => this.goRegister(), 1500)
        }
        return
      }
      setSession(result.user)
      this.navigateHome()
    } finally {
      this.setData({ loading: false })
    }
  },

  async onStaffLogin() {
    if (this.data.loading) return
    const { activeRole, username, password } = this.data

    if (activeRole !== 'reviewer' && activeRole !== 'admin') return

    this.setData({ loading: true })
    try {
      const result = await loginStaff({ username, password, role: activeRole })
      if (!result.success || !result.user) {
        wx.showToast({ title: result.message || '登录失败', icon: 'none' })
        return
      }
      setSession(result.user)
      this.navigateHome()
    } finally {
      this.setData({ loading: false })
    }
  },

  navigateHome() {
    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/index/index' })
    }, 800)
  },
})
