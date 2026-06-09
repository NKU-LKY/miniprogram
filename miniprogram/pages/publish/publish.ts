import { SPECIES_CATEGORIES } from '../../data/species-categories'
import { createObservation } from '../../services/api/observation'
import { getDeviceLocation, hasValidCoordinate } from '../../utils/geo'
import {
  clearPublishDraft,
  loadPublishDraft,
  savePublishDraft,
  type PublishDraft,
} from '../../utils/publish-draft'
import { resolveNearbyLandmark } from '../../utils/tencent-map'
import { canPublishObservation } from '../../utils/permissions'
import { getCurrentUser } from '../../utils/session'

const REFRESH_FEED_KEY = 'campus_bio_refresh_feed'

let draftSaveTimer = 0

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
    locationName: '',
    locationDetail: '',
    latitude: 0,
    longitude: 0,
    hasLocation: false,
    locating: false,
    resolvingName: false,
    locationFailed: false,
    speciesCategories: SPECIES_CATEGORIES,
    speciesCategoryIndex: -1,
    speciesCategoryName: '',
    speciesRemark: '',
    needsIdentification: false,
    saveDraftEnabled: false,
    submitting: false,
  },

  onLoad() {
    const user = getCurrentUser()
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    if (!canPublishObservation(user)) {
      wx.showToast({ title: '仅观测者可发布记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }

    const draft = loadPublishDraft(user.user_id)
    if (draft) {
      this.setData({
        photoPath: draft.photoPath || '',
        note: draft.note || '',
        locationName: draft.locationName || '',
        locationDetail: draft.locationDetail || '',
        latitude: draft.latitude || 0,
        longitude: draft.longitude || 0,
        hasLocation: draft.hasLocation === true,
        speciesCategoryIndex: draft.speciesCategoryIndex ?? -1,
        speciesCategoryName: draft.speciesCategoryName || '',
        speciesRemark: draft.speciesRemark || '',
        needsIdentification: draft.needsIdentification === true,
        saveDraftEnabled: true,
        locationFailed: false,
      })
      wx.showToast({ title: '已恢复上次填写内容', icon: 'none' })
      return
    }

    this.locateByDevice()
  },

  onHide() {
    void this.persistDraft()
  },

  onUnload() {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer)
    }
  },

  scheduleSaveDraft() {
    if (!this.data.saveDraftEnabled) return
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer)
    }
    draftSaveTimer = setTimeout(() => {
      void this.persistDraft()
    }, 300)
  },

  async persistDraft() {
    const user = getCurrentUser()
    if (!user || !this.data.saveDraftEnabled) return

    let photoPath = this.data.photoPath
    if (photoPath) {
      photoPath = await savePhoto(photoPath)
    }

    const draft: PublishDraft = {
      saveDraftEnabled: true,
      photoPath,
      note: this.data.note,
      locationName: this.data.locationName,
      locationDetail: this.data.locationDetail,
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      hasLocation: this.data.hasLocation,
      speciesCategoryName: this.data.speciesCategoryName,
      speciesCategoryIndex: this.data.speciesCategoryIndex,
      speciesRemark: this.data.speciesRemark,
      needsIdentification: this.data.needsIdentification,
      updatedAt: new Date().toISOString(),
    }
    savePublishDraft(user.user_id, draft)

    if (photoPath !== this.data.photoPath) {
      this.setData({ photoPath })
    }
  },

  onDraftToggle(e: WechatMiniprogram.SwitchChange) {
    const enabled = e.detail.value
    this.setData({ saveDraftEnabled: enabled })

    const user = getCurrentUser()
    if (!user) return

    if (enabled) {
      void this.persistDraft()
      wx.showToast({ title: '已开启内容暂存', icon: 'none' })
      return
    }

    clearPublishDraft(user.user_id)
    wx.showToast({ title: '已关闭并清除暂存', icon: 'none' })
  },

  applyLocation(latitude: number, longitude: number, name: string) {
    this.setData({
      latitude,
      longitude,
      locationName: name,
      hasLocation: true,
      locationFailed: false,
    })
    this.scheduleSaveDraft()
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
          this.scheduleSaveDraft()
        }
      },
    })
  },

  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ note: e.detail.value })
    this.scheduleSaveDraft()
  },

  onLocationDetailInput(e: WechatMiniprogram.Input) {
    this.setData({ locationDetail: e.detail.value })
    this.scheduleSaveDraft()
  },

  onOpenMapPicker() {
    const { locationName, latitude, longitude, hasLocation } = this.data
    const name = encodeURIComponent(locationName || '')
    const lat = hasLocation ? latitude : ''
    const lng = hasLocation ? longitude : ''
    wx.navigateTo({
      url: `/pages/publish/select-location/select-location?lat=${lat}&lng=${lng}&name=${name}`,
      events: {
        selectLocation: (data: { name: string; latitude: number; longitude: number }) => {
          if (!data || !hasValidCoordinate(data)) return
          this.applyLocation(data.latitude, data.longitude, data.name)
        },
      },
    })
  },

  onSpeciesCategoryChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value)
    const category = SPECIES_CATEGORIES[index]
    if (!category) return

    this.setData({
      speciesCategoryIndex: index,
      speciesCategoryName: category.name,
    })
    this.scheduleSaveDraft()
  },

  onClearSpeciesCategory() {
    this.setData({
      speciesCategoryIndex: -1,
      speciesCategoryName: '',
      speciesRemark: '',
    })
    this.scheduleSaveDraft()
  },

  onSpeciesRemarkInput(e: WechatMiniprogram.Input) {
    this.setData({ speciesRemark: e.detail.value })
    this.scheduleSaveDraft()
  },

  onIdentificationChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ needsIdentification: e.detail.value })
    this.scheduleSaveDraft()
  },

  async locateByDevice() {
    if (this.data.locating || this.data.resolvingName) return

    this.setData({ locating: true, locationFailed: false })

    try {
      const coord = await getDeviceLocation()
      this.setData({ locating: false, resolvingName: true })
      const name = await resolveNearbyLandmark(coord)
      this.applyLocation(coord.latitude, coord.longitude, name)
      this.setData({ resolvingName: false })
    } catch (err) {
      console.error('locate error:', err)
      this.setData({
        locating: false,
        resolvingName: false,
        locationFailed: true,
        locationName: '',
        hasLocation: false,
      })
      wx.showToast({ title: '无法获取位置，请在地图上选择', icon: 'none' })
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

    if (this.data.locating || this.data.resolvingName) {
      wx.showToast({ title: '请等待地点解析完成', icon: 'none' })
      return
    }

    if (!this.data.hasLocation) {
      wx.showToast({ title: '请等待定位完成或在地图上选择地点', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const photoUrl = await savePhoto(this.data.photoPath)
      await createObservation({
        user_id: user.user_id,
        photo_url: photoUrl,
        location_name: this.data.locationName.trim(),
        location_detail: this.data.locationDetail.trim(),
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        note: this.data.note.trim(),
        species_name: this.data.speciesCategoryName.trim() || undefined,
        species_remark: this.data.speciesRemark.trim() || undefined,
        needs_identification: this.data.needsIdentification,
      })

      clearPublishDraft(user.user_id)
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
