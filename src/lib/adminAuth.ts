import { getCurrentUser } from './auth'

// マスタ管理などの管理者用API向け。ログイン済みで、会社管理者か協会管理者のロールを持つユーザーを返す
export async function getAdminUser() {
  const user = await getCurrentUser()
  if (!user) return null
  const roles = (user.roles as string[] | null) ?? []
  return roles.includes('company_admin') || roles.includes('union_admin') ? user : null
}
