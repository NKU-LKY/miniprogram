/** 根据物种名称判断是否为动物（用于展示活跃时段） */
export function isAnimalSpecies(speciesName: string): boolean {
  const name = speciesName.trim()
  if (!name) return false
  return /猫|狗|鼠|兔|松鼠|刺猬|鸟|雀|鹊|鹰|鸭|鹅|鸽|鱼|鲤|鲫|蝶|蛾|蜂|虫|蜻蜓|瓢虫|蛙|龟|蛇|狐|狸/.test(name)
}
