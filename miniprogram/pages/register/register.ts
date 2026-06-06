import { registerObserver } from '../../services/api/auth'
import { setSession } from '../../utils/session'

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    nickname: '',
    avatarUrl: DEFAULT_AVATAR,
    loading: false,
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      this.setData({ avatarUrl })
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value })
  },

  async onRegister() {
    if (this.data.loading) return

    const { nickname, avatarUrl } = this.data
    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const result = await registerObserver({
        nickname: nickname.trim(),
        avatar_url: avatarUrl,
      })

      if (!result.success || !result.user) {
        wx.showToast({ title: result.message || '注册失败', icon: 'none' })
        return
      }

      setSession(result.user)
      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/index/index' })
      }, 800)
    } finally {
      this.setData({ loading: false })
    }
  },
})
