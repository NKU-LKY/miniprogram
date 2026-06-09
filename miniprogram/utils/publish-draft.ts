import { getLocalItem, removeLocalItem, setLocalItem } from '../services/local/storage'

export interface PublishDraft {
  saveDraftEnabled: boolean
  photoPath: string
  note: string
  locationName: string
  locationDetail: string
  latitude: number
  longitude: number
  hasLocation: boolean
  speciesCategoryName: string
  speciesCategoryIndex: number
  speciesRemark: string
  needsIdentification: boolean
  updatedAt: string
}

function draftKey(userId: string): string {
  return `publish_draft_${userId.trim()}`
}

export function loadPublishDraft(userId: string): PublishDraft | null {
  const draft = getLocalItem<PublishDraft>(draftKey(userId))
  if (!draft || !draft.saveDraftEnabled) return null
  return draft
}

export function savePublishDraft(userId: string, draft: PublishDraft): void {
  setLocalItem(draftKey(userId), draft)
}

export function clearPublishDraft(userId: string): void {
  removeLocalItem(draftKey(userId))
}
