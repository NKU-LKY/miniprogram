import { countPendingIdentification } from '../../services/local/identification-api'
import { getUnreadNotificationCount } from '../../services/local/notification-api'
import { findUserById } from '../../services/local/user-store'
import { getFeedLocationOptions, getFeedSpeciesOptions, getMyLocationOptions, getMySpeciesOptions, listFeed, listMyFeed } from '../../services/local/observation-api'
import { listSpeciesArchives } from '../../services/local/species-api'
import type { ObservationFeedItem } from '../../types/observation'
import type { SpeciesArchiveSummary } from '../../types/species'
import { ROLE_LABELS } from '../../types/user'
import {
  buildFilterParams,
  isFilterActive,
  TIME_RANGE_OPTIONS,
  type FilterOption,
  type ObservationFilterParams,
  type TimeFilterOption,
} from '../../utils/observation-filter'
import { isOnboardingCompleted, markOnboardingCompleted } from '../../utils/onboarding'
import { canPublishObservation } from '../../utils/permissions'
import { clearSession, getCurrentUser, refreshSessionUser } from '../../utils/session'

/** 每页 6 条，与一屏可见数量一致，上滑加载下一页 */
const PAGE_SIZE = 6

const REFRESH_FEED_KEY = 'campus_bio_refresh_feed'

type ActiveTab = 'feed' | 'mine' | 'species'

interface GuideRect {
  top: number
  left: number
  width: number
  height: number
}

interface GuideStepConfig {
  selector: string
  title: string
  desc: string
  radius: number
  prepare?: (page: WechatMiniprogram.Page.TrivialInstance) => void
}

const GUIDE_STEPS: GuideStepConfig[] = [
  {
    selector: '.guide-target-avatar',
    title: '个人中心',
    desc: '点击头像框打开个人中心',
    radius: 999,
  },
  {
    selector: '.guide-target-map',
    title: '校园地图',
    desc: '在这里打开校园地图',
    radius: 12,
  },
  {
    selector: '.guide-target-feed',
    title: '最新分享',
    desc: '在这里查看大家分享的记录',
    radius: 0,
    prepare(page) {
      if (page.data.activeTab !== 'feed') {
        page.setData({ activeTab: 'feed' })
      }
    },
  },
  {
    selector: '.guide-target-fab',
    title: '上传与搜索',
    desc: '点击这里上传你的发现/搜索记录',
    radius: 999,
    prepare(page) {
      if (page.data.activeTab === 'species') {
        page.setData({ activeTab: 'feed' })
      }
      page.setData({ fabExpanded: false, showSearch: false, showUserMenu: false })
    },
  },
]

interface FlatFeedItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name: string
  species_label: string
  status_label: string
  time_text: string
  like_count: number
  comment_count: number
  publisher_nickname: string
  publisher_avatar_url: string
  is_featured: boolean
}

function flattenItem(item: ObservationFeedItem): FlatFeedItem {
  return {
    obs_id: item.obs_id,
    photo_url: item.photo_url,
    note: item.note || '',
    location_name: item.location_name,
    species_name: item.species_name || '',
    species_label: item.species_label || item.species_name || '',
    status_label: item.status_label || '',
    time_text: item.time_text,
    like_count: item.like_count,
    comment_count: item.comment_count,
    publisher_nickname: item.publisher.nickname,
    publisher_avatar_url: item.publisher.avatar_url,
    is_featured: item.is_featured,
  }
}

Page({
  data: {
    activeTab: 'feed' as ActiveTab,
    feedList: [] as FlatFeedItem[],
    page: 1,
    hasMore: true,
    loading: true,
    loadingMore: false,
    myList: [] as FlatFeedItem[],
    myPage: 1,
    myHasMore: true,
    myLoading: false,
    myLoadingMore: false,
    myLoaded: false,
    showStatusBar: false,
    statusBarLoading: false,
    statusBarHasMore: false,
    nickname: '',
    avatarUrl: '',
    roleLabel: '',
    showUserMenu: false,
    refreshing: false,
    isObserver: false,
    isReviewer: false,
    isAdmin: false,
    pendingIdentificationCount: 0,
    hasUnreadNotifications: false,
    speciesOptions: [{ label: '全部物种', value: '' }] as FilterOption[],
    locationOptions: [{ label: '全部地点', value: '' }] as FilterOption[],
    timeOptions: TIME_RANGE_OPTIONS as TimeFilterOption[],
    speciesIndex: 0,
    locationIndex: 0,
    timeIndex: 0,
    featuredOnly: false,
    filterActive: false,
    showSearch: false,
    searchFocus: false,
    searchInput: '',
    searchKeyword: '',
    fabExpanded: false,
    speciesList: [] as SpeciesArchiveSummary[],
    speciesLoading: false,
    speciesLoaded: false,
    guideVisible: false,
    guideStep: 0,
    guideTotalSteps: GUIDE_STEPS.length,
    guideRect: { top: 0, left: 0, width: 0, height: 0 } as GuideRect,
    guideTitle: '',
    guideDesc: '',
    guideRadius: 12,
  },

  onLoad() {
    if (!this.ensureLoggedIn()) return
    this.syncUserInfo()
    this.refreshFilterOptions()
    this.loadFeed(true)
  },

  onReady() {
    this.tryStartOnboarding()
  },

  onShow() {
    if (!this.ensureLoggedIn()) return
    this.syncUserInfo()
    this.refreshFilterOptions()
    this.handlePublishReturn()
    if (this.data.activeTab === 'species' && this.data.speciesLoaded) {
      this.loadSpeciesArchives()
    }
    this.tryStartOnboarding()
  },

  ensureLoggedIn(): boolean {
    const refreshed = refreshSessionUser((userId) => {
      const user = findUserById(userId)
      if (!user) return null
      const { password_hash: _, ...safe } = user
      return safe
    })
    if (!refreshed) {
      wx.redirectTo({ url: '/pages/login/login' })
      return false
    }
    return true
  },

  syncUserInfo() {
    const user = getCurrentUser()
    if (!user) return
    getApp<IAppOption>().setCurrentUser(user)
    const isReviewer = user.role === 'reviewer'
    this.setData({
      nickname: user.nickname || '未命名用户',
      avatarUrl: user.avatar_url || '',
      roleLabel: ROLE_LABELS[user.role] || '',
      isObserver: canPublishObservation(user),
      isReviewer,
      isAdmin: user.role === 'admin',
      pendingIdentificationCount: isReviewer ? countPendingIdentification() : 0,
      hasUnreadNotifications: getUnreadNotificationCount(user.user_id) > 0,
    })
  },

  onGoProfile() {
    this.setData({ showUserMenu: false })
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onGoReviewerQueue() {
    this.setData({ showUserMenu: false })
    wx.navigateTo({ url: '/pages/reviewer/queue/queue' })
  },

  onGoAdminUsers() {
    this.setData({ showUserMenu: false })
    wx.navigateTo({ url: '/pages/admin/users/users' })
  },

  onGoAdminModeration() {
    this.setData({ showUserMenu: false })
    wx.navigateTo({ url: '/pages/admin/moderation/moderation' })
  },

  handlePublishReturn() {
    try {
      if (!wx.getStorageSync(REFRESH_FEED_KEY)) return
      wx.removeStorageSync(REFRESH_FEED_KEY)
      this.setData({ activeTab: 'feed', myLoaded: false, speciesLoaded: false })
      this.loadFeed(true)
    } catch (err) {
      // ignore storage errors
    }
  },

  onGoPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  onGoMap() {
    wx.navigateTo({ url: '/pages/map/map' })
  },

  refreshFilterOptions() {
    const user = getCurrentUser()
    const observationsSource =
      this.data.activeTab === 'feed' ? 'feed' : 'mine'
    const speciesOptions =
      observationsSource === 'feed'
        ? getFeedSpeciesOptions()
        : getMySpeciesOptions((user && user.user_id) || '')
    const locationOptions =
      observationsSource === 'feed'
        ? getFeedLocationOptions()
        : getMyLocationOptions((user && user.user_id) || '')

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
        this.data.searchKeyword,
      ),
    })
  },

  getCurrentFilter(): ObservationFilterParams {
    const {
      speciesOptions,
      speciesIndex,
      locationOptions,
      locationIndex,
      timeOptions,
      timeIndex,
      featuredOnly,
      searchKeyword,
    } = this.data
    return buildFilterParams(
      speciesOptions[speciesIndex],
      timeOptions[timeIndex],
      featuredOnly,
      locationOptions[locationIndex],
      searchKeyword,
    )
  },

  onFilterChange(e: WechatMiniprogram.CustomEvent) {
    const { type, index } = e.detail as { type: 'species' | 'location' | 'time' | 'featured'; index?: number }
    const speciesIndex = type === 'species' && index !== undefined ? index : this.data.speciesIndex
    const locationIndex = type === 'location' && index !== undefined ? index : this.data.locationIndex
    const timeIndex = type === 'time' && index !== undefined ? index : this.data.timeIndex
    const featuredOnly = type === 'featured' ? !this.data.featuredOnly : this.data.featuredOnly
    const filter = buildFilterParams(
      this.data.speciesOptions[speciesIndex],
      this.data.timeOptions[timeIndex],
      featuredOnly,
      this.data.locationOptions[locationIndex],
      this.data.searchKeyword,
    )

    this.setData({
      speciesIndex,
      locationIndex,
      timeIndex,
      featuredOnly,
      filterActive: isFilterActive(
        speciesIndex,
        timeIndex,
        featuredOnly,
        locationIndex,
        this.data.searchKeyword,
      ),
    })

    if (this.data.activeTab === 'feed') {
      this.loadFeed(true, filter)
    } else {
      this.loadMyFeed(true, filter)
    }
  },

  onResetFilter() {
    const filter = buildFilterParams(
      this.data.speciesOptions[0],
      this.data.timeOptions[0],
      false,
      this.data.locationOptions[0],
    )
    this.setData({
      speciesIndex: 0,
      locationIndex: 0,
      timeIndex: 0,
      featuredOnly: false,
      filterActive: false,
      showSearch: false,
      searchFocus: false,
      searchInput: '',
      searchKeyword: '',
      fabExpanded: false,
    })
    if (this.data.activeTab === 'feed') {
      this.loadFeed(true, filter)
    } else {
      this.loadMyFeed(true, filter)
    }
  },

  preventTouchMove() {},

  onFabToggle() {
    this.setData({ fabExpanded: !this.data.fabExpanded })
  },

  onCloseFab() {
    this.setData({ fabExpanded: false })
  },

  onFabPublish() {
    this.setData({ fabExpanded: false })
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  onFabSearch() {
    this.setData({ fabExpanded: false, showSearch: true, searchFocus: true })
    setTimeout(() => this.setData({ searchFocus: false }), 300)
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    this.setData({ searchInput: e.detail.value })
  },

  onSearchConfirm() {
    const searchKeyword = this.data.searchInput.trim()
    const filter = buildFilterParams(
      this.data.speciesOptions[this.data.speciesIndex],
      this.data.timeOptions[this.data.timeIndex],
      this.data.featuredOnly,
      this.data.locationOptions[this.data.locationIndex],
      searchKeyword,
    )

    this.setData({
      searchInput: searchKeyword,
      searchKeyword,
      filterActive: isFilterActive(
        this.data.speciesIndex,
        this.data.timeIndex,
        this.data.featuredOnly,
        this.data.locationIndex,
        searchKeyword,
      ),
    })

    if (this.data.activeTab === 'feed') {
      this.loadFeed(true, filter)
    } else {
      this.loadMyFeed(true, filter)
    }
  },

  onSearchClear() {
    const filter = buildFilterParams(
      this.data.speciesOptions[this.data.speciesIndex],
      this.data.timeOptions[this.data.timeIndex],
      this.data.featuredOnly,
      this.data.locationOptions[this.data.locationIndex],
    )

    this.setData({
      searchInput: '',
      searchKeyword: '',
      filterActive: isFilterActive(
        this.data.speciesIndex,
        this.data.timeIndex,
        this.data.featuredOnly,
        this.data.locationIndex,
      ),
    })

    if (this.data.activeTab === 'feed') {
      this.loadFeed(true, filter)
    } else {
      this.loadMyFeed(true, filter)
    }
  },

  updateStatusBar() {
    const { activeTab, feedList, myList, loadingMore, myLoadingMore, hasMore, myHasMore } = this.data
    const isFeed = activeTab === 'feed'
    const listLen = isFeed ? feedList.length : myList.length
    this.setData({
      showStatusBar: listLen > 0,
      statusBarLoading: isFeed ? loadingMore : myLoadingMore,
      statusBarHasMore: isFeed ? hasMore : myHasMore,
    })
  },

  /** 首屏内容未填满滚动区域时，自动补拉下一页 */
  ensureFillViewport() {
    const isFeed = this.data.activeTab === 'feed'
    const hasMore = isFeed ? this.data.hasMore : this.data.myHasMore
    const loadingMore = isFeed ? this.data.loadingMore : this.data.myLoadingMore
    if (!hasMore || loadingMore) return

    const query = this.createSelectorQuery()
    query.select('.scrollarea').boundingClientRect()
    query.select('.list-status-bar').boundingClientRect()
    query.exec((res) => {
      const scrollRect = res[0]
      const statusRect = res[1]
      if (!scrollRect) return

      const contentBottom = statusRect ? statusRect.bottom : scrollRect.bottom
      if (contentBottom <= scrollRect.bottom + 2) {
        if (isFeed) {
          this.loadFeed(false)
        } else {
          this.loadMyFeed(false)
        }
      }
    })
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as ActiveTab
    if (!tab || tab === this.data.activeTab) return

    this.setData({
      activeTab: tab,
      showUserMenu: false,
      speciesIndex: 0,
      locationIndex: 0,
      timeIndex: 0,
      featuredOnly: false,
      filterActive: false,
      showSearch: false,
      searchFocus: false,
      searchInput: '',
      searchKeyword: '',
      fabExpanded: false,
    })

    this.refreshFilterOptions()

    if (tab === 'mine') {
      this.loadMyFeed(true)
    } else if (tab === 'species') {
      this.loadSpeciesArchives()
    } else {
      this.loadFeed(true)
    }
  },

  loadSpeciesArchives() {
    this.setData({ speciesLoading: true })

    try {
      const speciesList = listSpeciesArchives()
      this.setData({
        speciesList,
        speciesLoading: false,
        speciesLoaded: true,
        refreshing: false,
      })
    } catch (err) {
      console.error('loadSpeciesArchives error:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ speciesLoading: false, refreshing: false })
    }
  },

  loadFeed(reset: boolean, filterOverride?: ObservationFilterParams) {
    if (reset) {
      this.setData({ loading: true, page: 1, hasMore: true, loadingMore: false })
    } else {
      if (this.data.loadingMore || !this.data.hasMore) return
      this.setData({ loadingMore: true })
    }

    const page = reset ? 1 : this.data.page
    const filter = filterOverride || this.getCurrentFilter()

    try {
      const result = listFeed(page, PAGE_SIZE, filter)
      const newItems = result.list.map(flattenItem)
      const feedList = reset ? newItems : this.data.feedList.concat(newItems)

      this.setData({
        feedList,
        page: page + 1,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        refreshing: false,
      }, () => {
        this.updateStatusBar()
        if (result.hasMore) {
          this.ensureFillViewport()
        }
      })
    } catch (err) {
      console.error('loadFeed error:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ loading: false, loadingMore: false, refreshing: false })
      this.updateStatusBar()
    }
  },

  loadMyFeed(reset: boolean, filterOverride?: ObservationFilterParams) {
    const user = getCurrentUser()
    if (!user) return

    if (reset) {
      this.setData({ myLoading: true, myPage: 1, myHasMore: true, myLoadingMore: false })
    } else {
      if (this.data.myLoadingMore || !this.data.myHasMore) return
      this.setData({ myLoadingMore: true })
    }

    const page = reset ? 1 : this.data.myPage
    const filter = filterOverride || this.getCurrentFilter()

    try {
      const result = listMyFeed(user.user_id, page, PAGE_SIZE, filter)
      const newItems = result.list.map(flattenItem)
      const myList = reset ? newItems : this.data.myList.concat(newItems)

      this.setData({
        myList,
        myPage: page + 1,
        myHasMore: result.hasMore,
        myLoaded: true,
        myLoading: false,
        myLoadingMore: false,
        refreshing: false,
      }, () => {
        this.updateStatusBar()
        if (result.hasMore) {
          this.ensureFillViewport()
        }
      })
    } catch (err) {
      console.error('loadMyFeed error:', err)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      this.setData({ myLoading: false, myLoadingMore: false, refreshing: false })
      this.updateStatusBar()
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    if (this.data.activeTab === 'feed') {
      this.loadFeed(true)
    } else if (this.data.activeTab === 'mine') {
      this.loadMyFeed(true)
    } else {
      this.loadSpeciesArchives()
    }
  },

  onLoadMore() {
    if (this.data.activeTab === 'feed') {
      this.loadFeed(false)
    } else if (this.data.activeTab === 'mine') {
      this.loadMyFeed(false)
    }
  },

  onSpeciesTap(e: WechatMiniprogram.TouchEvent) {
    const speciesName = e.currentTarget.dataset.name as string
    if (!speciesName) return
    wx.navigateTo({ url: `/pages/species/species?name=${encodeURIComponent(speciesName)}` })
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    if (!obsId) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${obsId}` })
  },

  onAvatarTap() {
    this.setData({ showUserMenu: !this.data.showUserMenu })
  },

  onCloseMenu() {
    this.setData({ showUserMenu: false })
  },

  onLogout() {
    this.setData({ showUserMenu: false })
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#c45c5c',
      success: (res) => {
        if (!res.confirm) return
        clearSession()
        getApp<IAppOption>().setCurrentUser(null)
        wx.reLaunch({ url: '/pages/login/login' })
      },
    })
  },

  tryStartOnboarding() {
    const user = getCurrentUser()
    if (!user || isOnboardingCompleted(user.user_id) || this.data.guideVisible) return
    if ((this as WechatMiniprogram.Page.TrivialInstance & { _onboardingScheduled?: boolean })._onboardingScheduled) {
      return
    }
    ;(this as WechatMiniprogram.Page.TrivialInstance & { _onboardingScheduled?: boolean })._onboardingScheduled = true

    setTimeout(() => {
      if (isOnboardingCompleted(user.user_id) || this.data.guideVisible) return
      this.setData({
        guideVisible: true,
        guideStep: 0,
        showUserMenu: false,
        fabExpanded: false,
        showSearch: false,
      }, () => {
        this.updateGuideStep()
      })
    }, 400)
  },

  updateGuideStep() {
    const step = GUIDE_STEPS[this.data.guideStep]
    if (!step) {
      this.finishOnboarding()
      return
    }

    if (step.prepare) {
      step.prepare(this)
    }

    this.setData({
      guideTitle: step.title,
      guideDesc: step.desc,
      guideRadius: step.radius,
    }, () => {
      setTimeout(() => this.measureGuideTarget(step.selector), 80)
    })
  },

  measureGuideTarget(selector: string) {
    const query = this.createSelectorQuery()
    query.select(selector).boundingClientRect()
    query.exec((res) => {
      const rect = res[0] as WechatMiniprogram.BoundingClientRectCallbackResult | null
      if (!rect || !rect.width || !rect.height) {
        if (this.data.guideStep + 1 < GUIDE_STEPS.length) {
          this.setData({ guideStep: this.data.guideStep + 1 }, () => this.updateGuideStep())
        } else {
          this.finishOnboarding()
        }
        return
      }

      const padding = 6
      this.setData({
        guideRect: {
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        },
      })
    })
  },

  onGuideNext() {
    const nextStep = this.data.guideStep + 1
    if (nextStep >= GUIDE_STEPS.length) {
      this.finishOnboarding()
      return
    }
    this.setData({ guideStep: nextStep }, () => this.updateGuideStep())
  },

  onGuideSkip() {
    this.finishOnboarding()
  },

  finishOnboarding() {
    const user = getCurrentUser()
    if (user) {
      markOnboardingCompleted(user.user_id)
    }
    this.setData({ guideVisible: false })
  },
})
