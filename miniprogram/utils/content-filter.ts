const BLOCKED_KEYWORDS = ['违禁', '赌博', '色情']

export function validateCommentContent(content: string): string | null {
  const text = content.trim()
  if (!text) return '评论内容不能为空'
  if (text.length > 200) return '评论不能超过 200 字'

  const lower = text.toLowerCase()
  const hit = BLOCKED_KEYWORDS.find((word) => lower.includes(word.toLowerCase()))
  if (hit) return '内容不符合社区规范，请修改后重新发送'

  return null
}
