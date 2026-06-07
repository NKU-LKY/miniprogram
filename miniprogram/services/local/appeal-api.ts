import type { OwnerAppealView } from '../../types/appeal'
import { formatRelativeTime } from '../../utils/time'
import {
  createAppeal,
  findPendingAppealByObsId,
  listAppealsByObsId,
} from './appeal-store'
import { notifyAdminsAppealReceived } from './notification-api'
import { getAllObservations } from './observation-store'

const APPEAL_STATUS_LABELS = {
  pending: '申诉处理中',
  approved: '申诉已通过',
  rejected: '申诉已驳回',
} as const

export interface SubmitAppealResult {
  success: boolean
  message?: string
}

function toOwnerAppealView(appeal: ReturnType<typeof listAppealsByObsId>[number]): OwnerAppealView {
  return {
    appeal_id: appeal.appeal_id,
    status: appeal.status,
    reason: appeal.reason,
    status_label: APPEAL_STATUS_LABELS[appeal.status],
    time_text: formatRelativeTime(appeal.created_at),
  }
}

export function getOwnerAppealForObs(obsId: string, userId: string): OwnerAppealView | null {
  const trimmedId = obsId.trim()
  const obs = getAllObservations().find((item) => item.obs_id === trimmedId)
  if (!obs || obs.user_id !== userId) return null

  const pending = findPendingAppealByObsId(trimmedId)
  if (pending) return toOwnerAppealView(pending)

  const latest = listAppealsByObsId(trimmedId)[0]
  return latest ? toOwnerAppealView(latest) : null
}

export function submitObservationAppeal(
  obsId: string,
  userId: string,
  reason: string,
): SubmitAppealResult {
  const trimmedId = obsId.trim()
  const trimmedReason = reason.trim()

  if (!trimmedId || !userId) {
    return { success: false, message: '参数无效' }
  }
  if (!trimmedReason) {
    return { success: false, message: '请填写申诉原因' }
  }
  if (trimmedReason.length > 500) {
    return { success: false, message: '申诉原因不能超过 500 字' }
  }

  const obs = getAllObservations().find((item) => item.obs_id === trimmedId)
  if (!obs) return { success: false, message: '记录不存在' }
  if (obs.user_id !== userId) return { success: false, message: '只能申诉自己的记录' }
  if (obs.status !== 'rejected') {
    return { success: false, message: '该记录当前不可申诉' }
  }

  if (findPendingAppealByObsId(trimmedId)) {
    return { success: false, message: '已有申诉正在处理中' }
  }

  const appeal = createAppeal({
    obs_id: trimmedId,
    user_id: userId,
    reason: trimmedReason,
  })

  try {
    notifyAdminsAppealReceived({
      appellantUserId: userId,
      obsId: trimmedId,
      appealId: appeal.appeal_id,
      reason: trimmedReason,
    })
  } catch (err) {
    console.warn('notifyAdminsAppealReceived failed:', err)
  }

  return { success: true }
}
