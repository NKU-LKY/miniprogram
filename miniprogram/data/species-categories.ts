/** 固定的物种类别（大类），用于观测标注与物种档案归类 */
export interface SpeciesCategory {
  name: string
  marker_label: string
  is_animal: boolean
}

export const SPECIES_CATEGORIES: SpeciesCategory[] = [
  { name: '鸟类', marker_label: '🐦', is_animal: true },
  { name: '哺乳类', marker_label: '🐾', is_animal: true },
  { name: '昆虫', marker_label: '🦋', is_animal: true },
  { name: '鱼类', marker_label: '🐟', is_animal: true },
  { name: '两栖爬行', marker_label: '🐸', is_animal: true },
  { name: '植物', marker_label: '🌿', is_animal: false },
  { name: '花卉', marker_label: '🌸', is_animal: false },
  { name: '其他', marker_label: '📍', is_animal: false },
]

export const SPECIES_CATEGORY_NAMES = SPECIES_CATEGORIES.map((item) => item.name)

export function getSpeciesCategory(name?: string): SpeciesCategory | undefined {
  const trimmed = (name || '').trim()
  if (!trimmed) return undefined
  return SPECIES_CATEGORIES.find((item) => item.name === trimmed)
}

export function getSpeciesCategoryIndex(name?: string): number {
  const trimmed = (name || '').trim()
  const index = SPECIES_CATEGORIES.findIndex((item) => item.name === trimmed)
  return index >= 0 ? index : 0
}

export function isValidSpeciesCategory(name: string): boolean {
  return SPECIES_CATEGORIES.some((item) => item.name === name.trim())
}
