import type { Appeal, AppealStatus } from '../../types/appeal'
import { getLocalItem, setLocalItem } from './storage'

const APPEALS_KEY = 'observation_appeals'

function generateAppealId(): string {
  return `apl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getAllAppeals(): Appeal[] {
  const stored = getLocalItem<Appeal[]>(APPEALS_KEY)
  return Array.isArray(stored) ? stored : []
}

function saveAppeals(list: Appeal[]): Appeal[] {
  setLocalItem(APPEALS_KEY, list)
  return list
}

export function listAppealsByObsId(obsId: string): Appeal[] {
  return getAllAppeals()
    .filter((item) => item.obs_id === obsId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function findAppealById(appealId: string): Appeal | undefined {
  return getAllAppeals().find((item) => item.appeal_id === appealId)
}

export function findPendingAppealByObsId(obsId: string): Appeal | undefined {
  return getAllAppeals().find((item) => item.obs_id === obsId && item.status === 'pending')
}

export function listPendingAppeals(): Appeal[] {
  return getAllAppeals()
    .filter((item) => item.status === 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export function createAppeal(input: {
  obs_id: string
  user_id: string
  reason: string
}): Appeal {
  const appeal: Appeal = {
    appeal_id: generateAppealId(),
    obs_id: input.obs_id,
    user_id: input.user_id,
    reason: input.reason.trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  const all = getAllAppeals()
  all.unshift(appeal)
  saveAppeals(all)
  return appeal
}

export function resolveAppeal(
  appealId: string,
  status: Exclude<AppealStatus, 'pending'>,
  resolvedBy: string,
): Appeal | null {
  const all = getAllAppeals()
  const index = all.findIndex((item) => item.appeal_id === appealId)
  if (index < 0 || all[index].status !== 'pending') return null

  all[index] = {
    ...all[index],
    status,
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
  }
  saveAppeals(all)
  return all[index]
}

export function resolvePendingAppealsForObs(
  obsId: string,
  status: Exclude<AppealStatus, 'pending'>,
  resolvedBy: string,
): number {
  const all = getAllAppeals()
  let count = 0
  const now = new Date().toISOString()

  const updated = all.map((item) => {
    if (item.obs_id !== obsId || item.status !== 'pending') return item
    count += 1
    return {
      ...item,
      status,
      resolved_at: now,
      resolved_by: resolvedBy,
    }
  })

  if (count > 0) {
    saveAppeals(updated)
  }

  return count
}
