/** 本地存储命名空间，与业务数据隔离 */
const NAMESPACE = 'campus_bio_local_'

export function getLocalItem<T>(key: string): T | null {
  try {
    const raw = wx.getStorageSync(NAMESPACE + key)
    if (raw === '' || raw === undefined || raw === null) {
      return null
    }
    return raw as T
  } catch (err) {
    return null
  }
}

export function setLocalItem<T>(key: string, value: T): void {
  wx.setStorageSync(NAMESPACE + key, value)
}

export function removeLocalItem(key: string): void {
  wx.removeStorageSync(NAMESPACE + key)
}

export function clearLocalNamespace(): void {
  const info = wx.getStorageInfoSync()
  info.keys
    .filter((k) => k.startsWith(NAMESPACE))
    .forEach((k) => wx.removeStorageSync(k))
}
