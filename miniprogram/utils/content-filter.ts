import { BLOCKED_KEYWORDS } from '../config/blocked-words'

const BLOCKED_MESSAGE = '内容不符合社区规范，请修改后重新发送'

export function findBlockedKeyword(content: string): string | undefined {
  const lower = content.toLowerCase()
  return BLOCKED_KEYWORDS.find((word) => lower.includes(word.toLowerCase()))
}

export function validateCommentContent(content: string): string | null {
  const text = content.trim()
  if (!text) return '评论内容不能为空'
  if (text.length > 200) return '评论不能超过 200 字'
  if (findBlockedKeyword(text)) return BLOCKED_MESSAGE
  return null
}
