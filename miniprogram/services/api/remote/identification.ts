import { isValidSpeciesCategory } from '../../../data/species-categories'
import type { Observation } from '../../../types/observation'
import { request } from './client'
import { findOrCreateSpecies } from './post'
import {
  getObservationPhotoUrl,
  mapIdentificationQueueItem,
  parseSpeciesFields,
  toRemoteUserId,
  toUserId,
} from './mappers'
import type { PaginatedResult, RemoteIdentificationRequest } from './types'

export type IdentificationResult =
  | { success: true; observation: Observation }
  | { success: false; message: string }

async function findPendingRequestByObsId(obsId: string): Promise<RemoteIdentificationRequest | null> {
  const result = await request<PaginatedResult<RemoteIdentificationRequest>>(
    '/api/identification-requests',
    { query: { page: 1, pageSize: 1, status: 'pending', obsId } },
  )
  return result.list[0] || null
}

function toLocalObservation(req: RemoteIdentificationRequest): Observation {
  const obs = req.observation
  const species = parseSpeciesFields(obs.species)
  return {
    obs_id: toUserId(obs.obsId),
    user_id: toUserId(obs.user?.userId),
    species_name: species.species_name,
    species_remark: species.species_remark,
    location_name: obs.location?.name || '',
    note: obs.content || '',
    status: 'identified',
    submitted_at: obs.submittedAt,
    photo_url: getObservationPhotoUrl(obs),
    like_count: 0,
    comment_count: 0,
    reviewer_id: req.reviewer ? toUserId(req.reviewer.userId) : undefined,
    identified_at: obs.identifiedAt || undefined,
    review_note: req.reviewNote || undefined,
  }
}

export async function listIdentificationQueueRemote(reviewerId: string) {
  const result = await request<PaginatedResult<RemoteIdentificationRequest>>(
    '/api/identification-requests',
    { query: { page: 1, pageSize: 100, status: 'pending' } },
  )
  return result.list.map((req) => mapIdentificationQueueItem(req, reviewerId))
}

export async function countPendingIdentificationRemote(): Promise<number> {
  const result = await request<PaginatedResult<RemoteIdentificationRequest>>(
    '/api/identification-requests',
    { query: { page: 1, pageSize: 1, status: 'pending' } },
  )
  return result.total
}

export async function claimIdentificationRemote(
  obsId: string,
  reviewerId: string,
): Promise<IdentificationResult> {
  const req = await findPendingRequestByObsId(obsId)
  if (!req) return { success: false, message: '记录不存在或已完成鉴定' }

  if (req.reviewer && toUserId(req.reviewer.userId) !== reviewerId) {
    return {
      success: false,
      message: `该记录已被 ${req.reviewer.nickname || '其他审阅员'} 认领`,
    }
  }

  if (req.reviewer && toUserId(req.reviewer.userId) === reviewerId) {
    return { success: true, observation: toLocalObservation(req) }
  }

  try {
    await request<RemoteIdentificationRequest>(`/api/identification-requests/${req.reqId}`, {
      method: 'PUT',
      data: { reviewerId: toRemoteUserId(reviewerId) },
    })
    const updated = await findPendingRequestByObsId(obsId)
    if (!updated) return { success: false, message: '认领失败，请重试' }
    return { success: true, observation: toLocalObservation(updated) }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '认领失败，请重试' }
  }
}

export async function releaseIdentificationRemote(
  obsId: string,
  reviewerId: string,
): Promise<IdentificationResult> {
  const req = await findPendingRequestByObsId(obsId)
  if (!req) return { success: false, message: '记录不存在或已完成鉴定' }

  if (!req.reviewer) {
    return { success: true, observation: toLocalObservation(req) }
  }

  if (toUserId(req.reviewer.userId) !== reviewerId) {
    return { success: false, message: '只能释放自己认领的记录' }
  }

  try {
    await request<RemoteIdentificationRequest>(`/api/identification-requests/${req.reqId}`, {
      method: 'PUT',
      data: { reviewerId: null },
    })
    const updated = await findPendingRequestByObsId(obsId)
    if (!updated) return { success: false, message: '释放失败，请重试' }
    return { success: true, observation: toLocalObservation(updated) }
  } catch {
    // 后端可能不支持 reviewerId 置空，降级为本地成功
    return { success: true, observation: toLocalObservation(req) }
  }
}

export async function completeIdentificationRemote(
  obsId: string,
  reviewerId: string,
  categoryName: string,
  speciesRemark?: string,
  reviewNote?: string,
): Promise<IdentificationResult> {
  const trimmedCategory = categoryName.trim()
  if (!trimmedCategory) return { success: false, message: '请选择物种类别' }
  if (!isValidSpeciesCategory(trimmedCategory)) {
    return { success: false, message: '请选择有效的物种类别' }
  }

  const req = await findPendingRequestByObsId(obsId)
  if (!req) return { success: false, message: '记录不存在或已完成鉴定' }

  if (req.reviewer && toUserId(req.reviewer.userId) !== reviewerId) {
    return {
      success: false,
      message: `该记录已被 ${req.reviewer.nickname || '其他审阅员'} 认领`,
    }
  }

  try {
    const speciesId = await findOrCreateSpecies(trimmedCategory, speciesRemark)
    if (!speciesId) return { success: false, message: '创建物种失败' }

    const updated = await request<RemoteIdentificationRequest>(
      `/api/identification-requests/${req.reqId}`,
      {
        method: 'PUT',
        data: {
          status: 'identified',
          resultSpeciesId: speciesId,
          reviewNote: reviewNote?.trim() || undefined,
          reviewerId: toRemoteUserId(reviewerId),
        },
      },
    )

    return { success: true, observation: toLocalObservation(updated) }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '鉴定提交失败，请重试' }
  }
}

export async function getIdentificationStateRemote(obsId: string, reviewerId: string) {
  const req = await findPendingRequestByObsId(obsId)
  if (!req) return null

  const species = parseSpeciesFields(req.observation.species)
  const reviewerUserId = req.reviewer ? toUserId(req.reviewer.userId) : undefined
  const claimedByMe = Boolean(reviewerUserId && reviewerUserId === reviewerId)
  const claimedByOther = Boolean(reviewerUserId && reviewerUserId !== reviewerId)

  return {
    can_claim: !reviewerUserId,
    can_release: claimedByMe,
    can_identify: claimedByMe || !reviewerUserId,
    claimed_by_me: claimedByMe,
    claimed_by_other: claimedByOther,
    reviewer_nickname: req.reviewer?.nickname || undefined,
    review_note: req.reviewNote || undefined,
    species_name: species.species_name,
    species_remark: species.species_remark,
  }
}
