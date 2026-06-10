import { getSpeciesArchive } from '../../services/api/species'
import type { SpeciesArchiveDetail } from '../../types/species'
import { getCurrentUser } from '../../utils/session'

Page({
  data: {
    loading: true,
    unavailable: false,
    detail: null as SpeciesArchiveDetail | null,
    maxLocationCount: 1,
  },

  onLoad(options: { name?: string }) {
    if (!getCurrentUser()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const speciesName = options.name ? decodeURIComponent(options.name) : ''
    if (!speciesName) {
      this.setData({ loading: false, unavailable: true })
      return
    }

    this.loadDetail(speciesName)
  },

  loadDetail(speciesName: string) {
    this.setData({ loading: true, unavailable: false })

    getSpeciesArchive(speciesName)
      .then((detail) => {
        if (!detail) {
          this.setData({ loading: false, unavailable: true, detail: null })
          return
        }

        const maxLocationCount = Math.max(...detail.common_locations.map((item) => item.count), 1)
        this.setData({
          loading: false,
          unavailable: false,
          detail,
          maxLocationCount,
        })
      })
      .catch((err) => {
        console.error('loadSpeciesDetail error:', err)
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
        this.setData({ loading: false, unavailable: true, detail: null })
      })
  },

  onPreviewPhoto(e: WechatMiniprogram.TouchEvent) {
    const detail = this.data.detail
    if (!detail) return

    const index = Number(e.currentTarget.dataset.index)
    const urls = detail.photo_wall.map((item) => item.photo_url)
    const current = urls[index] || urls[0]
    if (!current) return

    wx.previewImage({ current, urls })
  },

  onRecordTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },
})
