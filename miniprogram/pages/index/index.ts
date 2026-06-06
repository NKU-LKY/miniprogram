import { listFeed, listMyFeed } from '../../services/local/observation-api'
import type { ObservationFeedItem } from '../../types/observation'
import { ROLE_LABELS } from '../../types/user'
import { clearSession, getCurrentUser } from '../../utils/session'

/** 每页 6 条，与一屏可见数量一致，上滑加载下一页 */
const PAGE_SIZE = 6

const REFRESH_FEED_KEY = 'campus_bio_refresh_feed'

type ActiveTab = 'feed' | 'mine'

interface FlatFeedItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  species_name: string
  status_label: string
  time_text: string
  like_count: number
  comment_count: number
  publisher_nickname: string
  publisher_avatar_url: string
}

function flattenItem(item: ObservationFeedItem): FlatFeedItem {
  return {
    obs_id: item.obs_id,
    photo_url: item.photo_url,
    note: item.note || '',
    location_name: item.location_name,
    species_name: item.species_name || '',
    status_label: item.status_label || '',
    time_text: item.time_text,
    like_count: item.like_count,
    comment_count: item.comment_count,
    publisher_nickname: item.publisher.nickname,
    publisher_avatar_url: item.publisher.avatar_url,
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
  },

  onLoad() {
    if (!this.ensureLoggedIn()) return
    this.syncUserInfo()
    this.loadFeed(true)
  },

  onShow() {
    if (!this.ensureLoggedIn()) return
    this.syncUserInfo()
    this.handlePublishReturn()
  },

  ensureLoggedIn(): boolean {
    if (!getCurrentUser()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return false
    }
    return true
  },

  syncUserInfo() {
    const user = getCurrentUser()
    if (!user) return
    getApp<IAppOption>().setCurrentUser(user)
    this.setData({
      nickname: user.nickname || '未命名用户',
      avatarUrl: user.avatar_url || '',
      roleLabel: ROLE_LABELS[user.role] || '',
      isObserver: user.role === 'observer',
    })
  },

  handlePublishReturn() {
    try {
      if (!wx.getStorageSync(REFRESH_FEED_KEY)) return
      wx.removeStorageSync(REFRESH_FEED_KEY)
      this.setData({ activeTab: 'feed', myLoaded: false })
      this.loadFeed(true)
    } catch (err) {
      // ignore storage errors
    }
  },

  onGoPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
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
    })

    if (tab === 'mine' && !this.data.myLoaded) {
      this.loadMyFeed(true)
    } else {
      this.updateStatusBar()
    }
  },

  loadFeed(reset: boolean) {
    if (reset) {
      this.setData({ loading: true, page: 1, hasMore: true, loadingMore: false })
    } else {
      if (this.data.loadingMore || !this.data.hasMore) return
      this.setData({ loadingMore: true })
    }

    const page = reset ? 1 : this.data.page

    try {
      const result = listFeed(page, PAGE_SIZE)
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

  loadMyFeed(reset: boolean) {
    const user = getCurrentUser()
    if (!user) return

    if (reset) {
      this.setData({ myLoading: true, myPage: 1, myHasMore: true, myLoadingMore: false })
    } else {
      if (this.data.myLoadingMore || !this.data.myHasMore) return
      this.setData({ myLoadingMore: true })
    }

    const page = reset ? 1 : this.data.myPage

    try {
      const result = listMyFeed(user.user_id, page, PAGE_SIZE)
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
    } else {
      this.loadMyFeed(true)
    }
  },

  onLoadMore() {
    if (this.data.activeTab === 'feed') {
      this.loadFeed(false)
    } else {
      this.loadMyFeed(false)
    }
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const obsId = e.currentTarget.dataset.id as string
    wx.showToast({ title: '详情页开发中', icon: 'none' })
    console.log('card tap:', obsId)
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
})
