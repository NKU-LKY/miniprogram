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

  /** 点击「使用微信昵称」时触发，bindinput 不一定会被调用 */
  onNicknameReview(e: WechatMiniprogram.CustomEvent<{ nickname: string }>) {
    const nickname = (e.detail && e.detail.nickname) || ''
    if (nickname.trim()) {
      this.setData({ nickname: nickname.trim() })
    }
  },

  onNicknameBlur(e: WechatMiniprogram.Input) {
    const value = (e.detail.value || '').trim()
    if (value) {
      this.setData({ nickname: value })
    }
  },

  readNicknameFromInput(): Promise<string> {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .select('.input')
        .fields({ properties: ['value'] })
        .exec((res) => {
          const value = res[0] && (res[0] as { value?: string }).value
          resolve(typeof value === 'string' ? value.trim() : '')
        })
    })
  },

  async onRegister() {
    if (this.data.loading) return

    let { nickname, avatarUrl } = this.data
    nickname = nickname.trim()
    if (!nickname) {
      nickname = await this.readNicknameFromInput()
      if (nickname) {
        this.setData({ nickname })
      }
    }

    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const result = await registerObserver({
        nickname,
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
