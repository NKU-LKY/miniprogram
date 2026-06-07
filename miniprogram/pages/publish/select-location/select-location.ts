import { CAMPUS_MAP_CENTER, CAMPUS_MAP_SCALE } from '../../../data/locations'
import { getDeviceLocation, hasValidCoordinate } from '../../../utils/geo'
import { isCoordinateLabel, resolveNearbyLandmark } from '../../../utils/tencent-map'

let resolveSeq = 0

function buildSelectionMarker(latitude: number, longitude: number): WechatMiniprogram.MapMarker[] {
  return [
    {
      id: 1,
      latitude,
      longitude,
      width: 28,
      height: 28,
      callout: {
        content: '观测位置',
        display: 'ALWAYS',
        padding: 8,
        borderRadius: 8,
        fontSize: 12,
        color: '#ffffff',
        bgColor: '#4c8c4a',
        borderWidth: 0,
      },
    },
  ]
}

Page({
  data: {
    center: CAMPUS_MAP_CENTER,
    scale: CAMPUS_MAP_SCALE,
    markers: [] as WechatMiniprogram.MapMarker[],
    selectedName: '',
    selectedLat: 0,
    selectedLng: 0,
    hasSelection: false,
    locating: false,
    resolvingName: false,
  },

  onLoad(options: { lat?: string; lng?: string; name?: string }) {
    const lat = Number(options.lat)
    const lng = Number(options.lng)
    if (hasValidCoordinate({ latitude: lat, longitude: lng })) {
      const rawName = options.name ? decodeURIComponent(options.name) : ''
      const name = rawName && !isCoordinateLabel(rawName) ? rawName : '正在解析地点…'
      this.applySelection(lat, lng, name)
      if (!rawName || isCoordinateLabel(rawName)) {
        void this.resolveSelectionName(lat, lng)
      }
      return
    }
    void this.centerOnDevice(true)
  },

  async resolveSelectionName(latitude: number, longitude: number) {
    const seq = ++resolveSeq
    this.setData({ resolvingName: true })
    const name = await resolveNearbyLandmark({ latitude, longitude })
    if (seq !== resolveSeq) return
    this.applySelection(latitude, longitude, name)
    this.setData({ resolvingName: false })
  },

  applySelection(latitude: number, longitude: number, name: string) {
    this.setData({
      selectedLat: latitude,
      selectedLng: longitude,
      selectedName: name,
      hasSelection: true,
      markers: buildSelectionMarker(latitude, longitude),
      center: { latitude, longitude },
    })
  },

  async centerOnDevice(selectPoint?: boolean) {
    if (this.data.locating) return
    this.setData({ locating: true })

    try {
      const coord = await getDeviceLocation()
      this.setData({
        center: coord,
        locating: false,
      })
      if (selectPoint && !this.data.hasSelection) {
        this.applySelection(coord.latitude, coord.longitude, '正在解析地点…')
        void this.resolveSelectionName(coord.latitude, coord.longitude)
      }
    } catch (err) {
      console.error('centerOnDevice error:', err)
      this.setData({ locating: false })
    }
  },

  onMapTap(e: WechatMiniprogram.MapTap) {
    const { latitude, longitude } = e.detail
    if (!hasValidCoordinate({ latitude, longitude })) return
    this.applySelection(latitude, longitude, '正在解析地点…')
    void this.resolveSelectionName(latitude, longitude)
  },

  onLocateMe() {
    void this.centerOnDevice(true)
  },

  onConfirm() {
    const { hasSelection, selectedName, selectedLat, selectedLng } = this.data
    if (!hasSelection) {
      wx.showToast({ title: '请先在地图上点击选择位置', icon: 'none' })
      return
    }

    const eventChannel = this.getOpenerEventChannel()
    eventChannel.emit('selectLocation', {
      name: selectedName,
      latitude: selectedLat,
      longitude: selectedLng,
    })
    wx.navigateBack()
  },
})
