/** 物种档案列表项 */
export interface SpeciesArchiveSummary {
  species_name: string
  marker_label: string
  is_animal: boolean
  record_count: number
  cover_photo: string
  preview_photos: string[]
  top_location: string
  active_periods: string
  latest_time_text: string
}

/** 物种档案详情 */
export interface SpeciesArchiveDetail {
  species_name: string
  marker_label: string
  is_animal: boolean
  record_count: number
  photo_wall: SpeciesPhotoItem[]
  common_locations: SpeciesLocationStat[]
  active_periods: string
  related_records: SpeciesRelatedRecord[]
}

export interface SpeciesPhotoItem {
  obs_id: string
  photo_url: string
  time_text: string
}

export interface SpeciesLocationStat {
  name: string
  count: number
}

export interface SpeciesRelatedRecord {
  obs_id: string
  photo_url: string
  note: string
  location_name: string
  time_text: string
  like_count: number
}
