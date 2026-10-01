export const HOME_BY_ROLE: Record<string, string> = {
  driver: '/driver',
  company_admin: '/admin',
  union_admin: '/union/companies',
}

// 複数ロールを兼ねる場合の優先順位（管理系のロールを優先してホームにする）
const ROLE_PRIORITY = ['union_admin', 'company_admin', 'driver']

export function homeHrefForRoles(roles: string[] | undefined | null): string {
  const list = roles ?? []
  for (const role of ROLE_PRIORITY) {
    if (list.includes(role)) return HOME_BY_ROLE[role]
  }
  return '/driver'
}
