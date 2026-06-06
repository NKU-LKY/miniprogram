import { getCurrentUser } from './utils/session'
import type { SafeUser } from './types/user'

App<IAppOption>({
  globalData: {
    currentUser: null,
  },

  onLaunch() {
    const user = getCurrentUser()
    if (user) {
      this.globalData.currentUser = user
    }
  },

  setCurrentUser(user: SafeUser | null) {
    this.globalData.currentUser = user
  },
})
