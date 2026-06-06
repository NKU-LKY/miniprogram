import { getFeedSpeciesOptions, listMapObservations } from '../../services/local/observation-api'
import { CAMPUS_MAP_CENTER, CAMPUS_MAP_SCALE } from '../../data/locations'
import type { MapObservationItem } from '../../types/observation'
import { getDeviceLocation } from '../../utils/geo'
import { buildMapMarkers } from '../../utils/map-markers'
import {
  buildFilterParams,
  isFilterActive,
  TIME_RANGE_OPTIONS,
  type FilterOption,
  type ObservationFilterParams,
  type TimeFilterOption,
} from '../../utils/observation-filter'
import { getCurrentUser } from '../../utils/session'

type ViewMode = 'map' | 'list'

Page({
  data: {
    viewMode: 'map' as ViewMode,
    center: CAMPUS_MAP_CENTER,
    scale: CAMPUS_MAP_SCALE,
    markers: [] as WechatMiniprogram.MapMarker[],
    mapItems: [] as MapObservationItem[],
    markerIndexMap: {} as Record<number, string>,
    locating: false,
    useCampusFallback: false,
    speciesOptions: [{ label: '全部物种', value: '' }] as FilterOption[],
    timeOptions: TIME_RANGE_OPTIONS as TimeFilterOption[],
    speciesIndex: 0,
    timeIndex: 0,
    filterActive: false,
  },

  onLoad() {
    if (!getCurrentUser()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.refreshFilterOptions()
    this.loadMapData()
    void this.centerOnDevice(true)
  },

  onShow() {
    this.refreshFilterOptions()
    this.loadMapData()
  },

  refreshFilterOptions() {
    const speciesOptions = getFeedSpeciesOptions()
    const speciesIndex = Math.min(this.data.speciesIndex, Math.max(speciesOptions.length - 1, 0))

    this.setData({
      speciesOptions,
      speciesIndex,
      filterActive: isFilterActive(speciesIndex, this.data.timeIndex),
    })
  },

  getCurrentFilter(): ObservationFilterParams {
    const { speciesOptions, speciesIndex, timeOptions, timeIndex } = this.data
    return buildFilterParams(speciesOptions[speciesIndex], timeOptions[timeIndex])
  },

  onFilterChange(e: WechatMiniprogram.CustomEvent) {
    const { type, index } = e.detail as { type: 'species' | 'time'; index: number }
    const speciesIndex = type === 'species' ? index : this.data.speciesIndex
    const timeIndex = type === 'time' ? index : this.data.timeIndex

    this.setData({
      speciesIndex,
      timeIndex,
      filterActive: isFilterActive(speciesIndex, timeIndex),
    })
    this.loadMapData()
  },

  onResetFilter() {
    this.setData({ speciesIndex: 0, timeIndex: 0, filterActive: false })
    this.loadMapData()
  },

  loadMapData() {
    const mapItems = listMapObservations(this.getCurrentFilter())
    const markers = buildMapMarkers(mapItems)
    const markerIndexMap: Record<number, string> = {}

    mapItems.forEach((item, index) => {
      markerIndexMap[index + 1] = item.obs_id
    })

    this.setData({
      mapItems,
      markers,
      markerIndexMap,
    })
  },

  onSwitchMode(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as ViewMode
    if (!mode || mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
  },

  onMapError() {
    wx.showToast({ title: '地图加载失败，已切换为列表', icon: 'none' })
    this.setData({ viewMode: 'list' })
  },

  async centerOnDevice(silent = false) {
    if (this.data.locating) return

    this.setData({ locating: true })

    try {
      const coord = await getDeviceLocation()
      this.setData(
        {
          center: coord,
          scale: 16,
          locating: false,
          useCampusFallback: false,
        },
        () => {
          wx.createMapContext('campusMap', this).moveToLocation()
        },
      )
    } catch (err) {
      console.error('map locate error:', err)
      this.setData({
        center: CAMPUS_MAP_CENTER,
        scale: CAMPUS_MAP_SCALE,
        locating: false,
        useCampusFallback: true,
      })
      if (!silent) {
        wx.showToast({ title: '无法获取位置，已显示校园区域', icon: 'none' })
      }
    }
  },

  onLocateMe() {
    void this.centerOnDevice(false)
  },

  goToDetail(obsId: string) {
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },

  onMarkerTap(e: WechatMiniprogram.MarkerTap) {
    const obsId = this.data.markerIndexMap[e.detail.markerId]
    if (!obsId) return
    this.goToDetail(obsId)
  },

  onListItemTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    this.goToDetail(obsId)
  },
})
