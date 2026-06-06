import { CAMPUS_LOCATIONS } from '../../data/locations'
import { createObservation } from '../../services/api/observation'
import { findNearestCampusLocation, getDeviceLocation } from '../../utils/geo'
import { getCurrentUser } from '../../utils/session'

const REFRESH_FEED_KEY = 'campus_bio_refresh_feed'

function savePhoto(tempPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath: tempPath,
      success: (res) => resolve(res.savedFilePath),
      fail: () => resolve(tempPath),
    })
  })
}

Page({
  data: {
    photoPath: '',
    note: '',
    locationOptions: CAMPUS_LOCATIONS,
    locationIndex: -1,
    locationName: '',
    locating: false,
    locationFailed: false,
    speciesName: '',
    needsIdentification: false,
    submitting: false,
  },

  onLoad() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    if (user.role !== 'observer') {
      wx.showToast({ title: '仅观测者可发布记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.locateByDevice()
  },

  onChoosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (tempPath) {
          this.setData({ photoPath: tempPath })
        }
      },
    })
  },

  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ note: e.detail.value })
  },

  onLocationChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value)
    this.setData({
      locationIndex: index,
      locationName: this.data.locationOptions[index],
      locationFailed: false,
    })
  },

  onSpeciesInput(e: WechatMiniprogram.Input) {
    this.setData({ speciesName: e.detail.value })
  },

  onIdentificationChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ needsIdentification: e.detail.value })
  },

  async locateByDevice() {
    if (this.data.locating) return

    this.setData({ locating: true, locationFailed: false })

    try {
      const coord = await getDeviceLocation()
      const nearest = findNearestCampusLocation(coord)
      const locationIndex = CAMPUS_LOCATIONS.indexOf(nearest.name)

      this.setData({
        locationName: nearest.name,
        locationIndex: locationIndex >= 0 ? locationIndex : 0,
        locating: false,
        locationFailed: false,
      })
    } catch (err) {
      console.error('locate error:', err)
      this.setData({
        locating: false,
        locationFailed: true,
        locationName: '',
        locationIndex: -1,
      })
      wx.showToast({ title: '无法获取位置，请从列表选择', icon: 'none' })
    }
  },

  async onPublish() {
    if (this.data.submitting) return

    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    if (!this.data.photoPath) {
      wx.showToast({ title: '请至少上传一张照片', icon: 'none' })
      return
    }

    const locationName = this.data.locationName.trim()
    if (!locationName) {
      wx.showToast({ title: '请等待定位完成或手动选择地点', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const photoUrl = await savePhoto(this.data.photoPath)
      await createObservation({
        user_id: user.user_id,
        photo_url: photoUrl,
        location_name: locationName,
        note: this.data.note.trim(),
        species_name: this.data.speciesName.trim(),
        needs_identification: this.data.needsIdentification,
      })

      wx.setStorageSync(REFRESH_FEED_KEY, true)
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 800)
    } catch (err) {
      console.error('publish error:', err)
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  },
})
