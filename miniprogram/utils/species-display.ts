/** 格式化物种展示：大类 + 备注，如「鸟类（喜鹊）」 */
export function formatSpeciesLabel(category?: string, remark?: string): string {
  const cat = (category || '').trim()
  if (!cat) return ''
  const rem = (remark || '').trim()
  return rem ? `${cat}（${rem}）` : cat
}

/** 已鉴定状态标签，如「已鉴定·鸟类（喜鹊）」 */
export function formatIdentifiedStatusLabel(category?: string, remark?: string): string {
  const label = formatSpeciesLabel(category, remark)
  return label ? `已鉴定·${label}` : '已鉴定'
}
