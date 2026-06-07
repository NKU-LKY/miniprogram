/** 发布页支持语音输入的字段 */
export type VoiceInputTarget = 'note' | 'locationDetail' | 'speciesName'

const FOCUS_FIELD_MAP: Record<VoiceInputTarget, string> = {
  note: 'focusNote',
  locationDetail: 'focusLocationDetail',
  speciesName: 'focusSpeciesName',
}

/** 将识别文本追加到已有内容，并遵守字数上限 */
export function appendVoiceText(current: string, recognized: string, maxLength: number): string {
  const text = recognized.trim()
  if (!text) return current
  const joined = current.trim() ? `${current.trim()} ${text}` : text
  return joined.slice(0, maxLength)
}

/**
 * 引导使用系统键盘语音输入（个人开发者可用，无需插件或后端）。
 * 聚焦对应输入框并提示用户使用微信键盘上的麦克风键。
 */
export function guideKeyboardVoiceInput(
  page: WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>,
  target: VoiceInputTarget,
): void {
  const focusField = FOCUS_FIELD_MAP[target]
  page.setData({ [focusField]: true })
  wx.showToast({
    title: '请用键盘麦克风键说话',
    icon: 'none',
    duration: 2500,
  })
}

export function blurVoiceField(
  page: WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>,
  target: VoiceInputTarget,
): void {
  const focusField = FOCUS_FIELD_MAP[target]
  page.setData({ [focusField]: false })
}
