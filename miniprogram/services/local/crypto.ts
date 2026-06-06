/**
 * 本地临时密码处理（非生产级加密）
 * 生产环境应使用服务端 bcrypt，本模块随 local/ 目录一并删除
 */
export function hashPasswordLocal(password: string): string {
  return `LOCAL:${password}`
}

export function verifyPasswordLocal(password: string, hash: string): boolean {
  return hash === hashPasswordLocal(password)
}
