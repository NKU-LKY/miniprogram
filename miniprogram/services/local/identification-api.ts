import type { Observation } from '../../types/observation'
import { formatRelativeTime } from '../../utils/time'
import { createNotification } from './notification-store'
import { getAllObservations, updateObservation } from './observation-store'
import { findUserById } from './user-store'

export interface IdentificationQueueItem {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  submitted_at: string
  time_text: string
  publisher_nickname: string
  publisher_avatar_url: string
  reviewer_id?: string
  reviewer_nickname?: string
  claimed_at?: string
  claimed_time_text?: string
  is_claimed_by_me: boolean
  is_claimed_by_other: boolean
}

export type IdentificationResult =
  | { success: true; observation: Observation }
  | { success: false; message: string }

const DEFAULT_AVATAR =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

function toQueueItem(obs: Observation, currentReviewerId: string): IdentificationQueueItem {
  const publisher = findUserById(obs.user_id)
  const reviewer = obs.reviewer_id ? findUserById(obs.reviewer_id) : undefined
  const isClaimedByMe = Boolean(obs.reviewer_id && obs.reviewer_id === currentReviewerId)
  const isClaimedByOther = Boolean(obs.reviewer_id && obs.reviewer_id !== currentReviewerId)

  return {
    obs_id: obs.obs_id,
    photo_url: obs.photo_url,
    note: obs.note,
    location_name: obs.location_name,
    submitted_at: obs.submitted_at,
    time_text: formatRelativeTime(obs.submitted_at),
    publisher_nickname: (publisher && publisher.nickname) || '小林同学',
    publisher_avatar_url: (publisher && publisher.avatar_url) || DEFAULT_AVATAR,
    reviewer_id: obs.reviewer_id,
    reviewer_nickname: reviewer ? reviewer.nickname : undefined,
    claimed_at: obs.claimed_at,
    claimed_time_text: obs.claimed_at ? formatRelativeTime(obs.claimed_at) : undefined,
    is_claimed_by_me: isClaimedByMe,
    is_claimed_by_other: isClaimedByOther,
  }
}

function getPendingObservations(): Observation[] {
  return getAllObservations()
    .filter((obs) => obs.status === 'needs_identification')
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
}

function findObservationById(obsId: string): Observation | null {
  return getAllObservations().find((item) => item.obs_id === obsId.trim()) || null
}

function findPendingObservation(obsId: string): Observation | null {
  const obs = findObservationById(obsId)
  if (!obs || obs.status !== 'needs_identification') return null
  return obs
}

function sendIdentificationNotification(
  observation: Observation,
  reviewerId: string,
  speciesName: string,
  reviewNote?: string,
): void {
  if (observation.user_id === reviewerId) return

  const noteSuffix = reviewNote ? `，备注：${reviewNote}` : ''
  createNotification({
    user_id: observation.user_id,
    type: 'identification_result',
    title: '鉴定完成',
    content: `你提交的观测记录已被鉴定为「${speciesName}」${noteSuffix}`,
    obs_id: observation.obs_id,
    actor_user_id: reviewerId,
  })
}

export function listIdentificationQueue(reviewerId: string): IdentificationQueueItem[] {
  return getPendingObservations().map((obs) => toQueueItem(obs, reviewerId))
}

export function countPendingIdentification(): number {
  return getPendingObservations().length
}

export function claimIdentification(obsId: string, reviewerId: string): IdentificationResult {
  const obs = findPendingObservation(obsId)
  if (!obs) {
    return { success: false, message: '记录不存在或已完成鉴定' }
  }

  if (obs.reviewer_id && obs.reviewer_id !== reviewerId) {
    const reviewer = findUserById(obs.reviewer_id)
    return { success: false, message: `该记录已被 ${(reviewer && reviewer.nickname) || '其他审阅员'} 认领` }
  }

  if (obs.reviewer_id === reviewerId) {
    return { success: true, observation: obs }
  }

  const updated = updateObservation(obsId, {
    reviewer_id: reviewerId,
    claimed_at: new Date().toISOString(),
  })

  if (!updated) {
    return { success: false, message: '认领失败，请重试' }
  }

  return { success: true, observation: updated }
}

export function releaseIdentification(obsId: string, reviewerId: string): IdentificationResult {
  const obs = findPendingObservation(obsId)
  if (!obs) {
    return { success: false, message: '记录不存在或已完成鉴定' }
  }

  if (!obs.reviewer_id) {
    return { success: true, observation: obs }
  }

  if (obs.reviewer_id !== reviewerId) {
    return { success: false, message: '只能释放自己认领的记录' }
  }

  const updated = updateObservation(obsId, {
    reviewer_id: undefined,
    claimed_at: undefined,
  })

  if (!updated) {
    return { success: false, message: '释放失败，请重试' }
  }

  return { success: true, observation: updated }
}

export function completeIdentification(
  obsId: string,
  reviewerId: string,
  speciesName: string,
  reviewNote?: string,
): IdentificationResult {
  const trimmedSpecies = speciesName.trim()
  if (!trimmedSpecies) {
    return { success: false, message: '请填写鉴定物种名称' }
  }

  const obs = findObservationById(obsId)
  if (!obs) {
    return { success: false, message: '记录不存在' }
  }

  if (obs.status === 'identified') {
    return { success: true, observation: obs }
  }

  if (obs.status !== 'needs_identification') {
    return { success: false, message: '记录不存在或已完成鉴定' }
  }

  if (obs.reviewer_id && obs.reviewer_id !== reviewerId) {
    const reviewer = findUserById(obs.reviewer_id)
    return { success: false, message: `该记录已被 ${(reviewer && reviewer.nickname) || '其他审阅员'} 认领` }
  }

  const now = new Date().toISOString()
  const patch: Partial<Observation> = {
    species_name: trimmedSpecies,
    status: 'identified',
    identified_at: now,
    review_note: reviewNote ? reviewNote.trim() || undefined : undefined,
  }

  if (!obs.reviewer_id) {
    patch.reviewer_id = reviewerId
    patch.claimed_at = now
  }

  const updated = updateObservation(obsId, patch)
  if (!updated) {
    return { success: false, message: '鉴定提交失败，请重试' }
  }

  try {
    sendIdentificationNotification(
      updated,
      reviewerId,
      trimmedSpecies,
      reviewNote ? reviewNote.trim() || undefined : undefined,
    )
  } catch (err) {
    console.error('sendIdentificationNotification error:', err)
  }

  return { success: true, observation: updated }
}

export function getIdentificationState(
  obsId: string,
  reviewerId: string,
): {
  can_claim: boolean
  can_release: boolean
  can_identify: boolean
  claimed_by_me: boolean
  claimed_by_other: boolean
  reviewer_nickname?: string
  review_note?: string
} | null {
  const obs = findPendingObservation(obsId)
  if (!obs) return null

  const reviewer = obs.reviewer_id ? findUserById(obs.reviewer_id) : undefined
  const claimedByMe = Boolean(obs.reviewer_id && obs.reviewer_id === reviewerId)
  const claimedByOther = Boolean(obs.reviewer_id && obs.reviewer_id !== reviewerId)

  return {
    can_claim: !obs.reviewer_id,
    can_release: claimedByMe,
    can_identify: claimedByMe || !obs.reviewer_id,
    claimed_by_me: claimedByMe,
    claimed_by_other: claimedByOther,
    reviewer_nickname: reviewer ? reviewer.nickname : undefined,
    review_note: obs.review_note,
  }
}
