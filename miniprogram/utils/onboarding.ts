const ONBOARDING_KEY = 'onboarding_completed_users'

function getCompletedSet(): Record<string, boolean> {
  try {
    const raw = wx.getStorageSync(ONBOARDING_KEY)
    return raw && typeof raw === 'object' ? (raw as Record<string, boolean>) : {}
  } catch (err) {
    return {}
  }
}

function saveCompletedSet(set: Record<string, boolean>): void {
  wx.setStorageSync(ONBOARDING_KEY, set)
}

export function isOnboardingCompleted(userId: string): boolean {
  if (!userId) return true
  return !!getCompletedSet()[userId]
}

export function markOnboardingCompleted(userId: string): void {
  if (!userId) return
  const set = getCompletedSet()
  set[userId] = true
  saveCompletedSet(set)
}
