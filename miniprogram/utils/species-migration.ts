import type { Observation } from '../types/observation'
import { isValidSpeciesCategory } from '../data/species-categories'

/** 旧版种子/用户数据中使用的具体物种名 → 大类 + 备注 */
const LEGACY_SPECIES_MAP: Record<string, { category: string; remark: string }> = {
  橘猫: { category: '哺乳类', remark: '橘猫' },
  银杏: { category: '植物', remark: '银杏' },
  麻雀: { category: '鸟类', remark: '麻雀' },
  樱花: { category: '花卉', remark: '樱花' },
  桂花: { category: '花卉', remark: '桂花' },
  喜鹊: { category: '鸟类', remark: '喜鹊' },
  竹子: { category: '植物', remark: '竹子' },
  蝴蝶: { category: '昆虫', remark: '蝴蝶' },
  锦鲤: { category: '鱼类', remark: '锦鲤' },
}

function inferCategoryFromLegacyName(name: string): string {
  if (/猫|狗|鼠|兔|松鼠|刺猬|橘|哺乳/.test(name)) return '哺乳类'
  if (/鸟|雀|鹊|鹰|鸭|鹅|鸽|麻雀/.test(name)) return '鸟类'
  if (/鱼|鲤|鲫|锦鲤/.test(name)) return '鱼类'
  if (/蝶|蛾|蜂|虫|蜻蜓|瓢虫|蝴蝶/.test(name)) return '昆虫'
  if (/蛙|龟|蛇|蜥/.test(name)) return '两栖爬行'
  if (/花|樱|桂|梅|兰|菊|荷|玫瑰|月季|牡丹|花卉/.test(name)) return '花卉'
  if (/树|竹|银杏|松|草|叶|藤|蕨|植物/.test(name)) return '植物'
  return '其他'
}

/** 将旧版具体物种名解析为档案用的大类键 */
export function resolveSpeciesArchiveKey(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (isValidSpeciesCategory(trimmed)) return trimmed

  const legacy = LEGACY_SPECIES_MAP[trimmed]
  if (legacy) return legacy.category

  return inferCategoryFromLegacyName(trimmed)
}

/** 将观测记录中的旧版物种标注迁移为大类 + 备注 */
export function migrateObservationSpecies(obs: Observation): Observation {
  const name = (obs.species_name || '').trim()
  if (!name) return obs
  if (isValidSpeciesCategory(name)) return obs

  const legacy = LEGACY_SPECIES_MAP[name]
  if (legacy) {
    const existingRemark = (obs.species_remark || '').trim()
    return {
      ...obs,
      species_name: legacy.category,
      species_remark: existingRemark || legacy.remark,
    }
  }

  const category = inferCategoryFromLegacyName(name)
  const existingRemark = (obs.species_remark || '').trim()
  return {
    ...obs,
    species_name: category,
    species_remark: existingRemark || name,
  }
}
