/// <reference path="./types/index.d.ts" />

import type { SafeUser } from '../miniprogram/types/user'

interface IAppOption {
  globalData: {
    currentUser: SafeUser | null
  }
  setCurrentUser(user: SafeUser | null): void
}
