import { getFeedLocationOptions, getFeedSpeciesOptions, listMapObservations } from '../../services/local/observation-api'
import { CAMPUS_MAP_CENTER, CAMPUS_MAP_SCALE } from '../../data/locations'
import type { MapLocationGroup, MapObservationItem } from '../../types/observation'
import { getDeviceLocation } from '../../utils/geo'
import { groupMapObservationsByLocation } from '../../utils/map-locations'
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
    locationGroups: [] as MapLocationGroup[],
    markerIndexMap: {} as Record<number, string>,
    locating: false,
    useCampusFallback: false,
    speciesOptions: [{ label: '全部物种', value: '' }] as FilterOption[],
    locationOptions: [{ label: '全部地点', value: '' }] as FilterOption[],
    timeOptions: TIME_RANGE_OPTIONS as TimeFilterOption[],
    speciesIndex: 0,
    locationIndex: 0,
    timeIndex: 0,
    featuredOnly: false,
    filterActive: false,
    showLocationSheet: false,
    sheetVisible: false,
    activeLocation: null as MapLocationGroup | null,
    locationCount: 0,
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
    const locationOptions = getFeedLocationOptions()
    const speciesIndex = Math.min(this.data.speciesIndex, Math.max(speciesOptions.length - 1, 0))
    const locationIndex = Math.min(this.data.locationIndex, Math.max(locationOptions.length - 1, 0))

    this.setData({
      speciesOptions,
      locationOptions,
      speciesIndex,
      locationIndex,
      filterActive: isFilterActive(
        speciesIndex,
        this.data.timeIndex,
        this.data.featuredOnly,
        locationIndex,
      ),
    })
  },

  getCurrentFilter(): ObservationFilterParams {
    const { speciesOptions, speciesIndex, locationOptions, locationIndex, timeOptions, timeIndex, featuredOnly } =
      this.data
    const speciesOption = speciesOptions[speciesIndex] || speciesOptions[0] || { label: '全部物种', value: '' }
    const locationOption = locationOptions[locationIndex] || locationOptions[0] || { label: '全部地点', value: '' }
    const timeOption = timeOptions[timeIndex] || timeOptions[0] || TIME_RANGE_OPTIONS[0]
    return buildFilterParams(speciesOption, timeOption, featuredOnly, locationOption)
  },

  onFilterChange(e: WechatMiniprogram.CustomEvent) {
    const { type, index } = e.detail as { type: 'species' | 'location' | 'time' | 'featured'; index?: number }
    const speciesIndex = type === 'species' && index !== undefined ? index : this.data.speciesIndex
    const locationIndex = type === 'location' && index !== undefined ? index : this.data.locationIndex
    const timeIndex = type === 'time' && index !== undefined ? index : this.data.timeIndex
    const featuredOnly = type === 'featured' ? !this.data.featuredOnly : this.data.featuredOnly

    this.setData({
      speciesIndex,
      locationIndex,
      timeIndex,
      featuredOnly,
      filterActive: isFilterActive(speciesIndex, timeIndex, featuredOnly, locationIndex),
    })
    this.closeLocationSheet()
    this.loadMapData()
  },

  onResetFilter() {
    this.setData({ speciesIndex: 0, locationIndex: 0, timeIndex: 0, featuredOnly: false, filterActive: false })
    this.closeLocationSheet()
    this.loadMapData()
  },

  loadMapData() {
    try {
      const mapItems = listMapObservations(this.getCurrentFilter())
      const locationGroups = groupMapObservationsByLocation(mapItems)
      const markers = buildMapMarkers(locationGroups)
      const markerIndexMap: Record<number, string> = {}

      locationGroups.forEach((group, index) => {
        markerIndexMap[index + 1] = group.location_key
      })

      const activeKey = this.data.activeLocation && this.data.activeLocation.location_key
      const activeLocation =
        activeKey ? locationGroups.find((group) => group.location_key === activeKey) || null : null

      this.setData({
        mapItems,
        locationGroups,
        markers,
        markerIndexMap,
        locationCount: locationGroups.length,
        activeLocation,
        showLocationSheet: Boolean(activeLocation),
        sheetVisible: Boolean(activeLocation),
      })
    } catch (err) {
      console.error('loadMapData error:', err)
      wx.showToast({ title: '地图数据加载失败', icon: 'none' })
    }
  },

  onSwitchMode(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as ViewMode
    if (!mode || mode === this.data.viewMode) return
    this.closeLocationSheet()
    this.setData({ viewMode: mode })
  },

  onMapError(e: WechatMiniprogram.MapError) {
    console.error('map render error:', e.detail)
    wx.showToast({ title: '地图渲染异常，可切换列表查看', icon: 'none' })
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

  openLocationSheet(group: MapLocationGroup) {
    this.setData({
      activeLocation: group,
      showLocationSheet: true,
      sheetVisible: false,
    })

    wx.nextTick(() => {
      this.setData({ sheetVisible: true })
    })
  },

  closeLocationSheet() {
    if (!this.data.showLocationSheet) return

    this.setData({ sheetVisible: false })

    setTimeout(() => {
      if (!this.data.sheetVisible) {
        this.setData({
          showLocationSheet: false,
          activeLocation: null,
        })
      }
    }, 280)
  },

  onMarkerTap(e: WechatMiniprogram.MarkerTap) {
    const locationKey = this.data.markerIndexMap[e.detail.markerId]
    if (!locationKey) return

    const group = this.data.locationGroups.find((item) => item.location_key === locationKey)
    if (!group) return

    this.openLocationSheet(group)
  },

  onCloseLocationSheet() {
    this.closeLocationSheet()
  },

  preventTouchMove() {},

  onSheetRecordTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    this.goToDetail(obsId)
  },

  onListItemTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    this.goToDetail(obsId)
  },
})
