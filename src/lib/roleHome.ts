export const HOME_BY_ROLE: Record<string, string> = {
  driver: '/driver',
  company_admin: '/admin',
  union_admin: '/union/companies',
}

export function homeHrefForRole(role: string | undefined | null): string {
  return (role && HOME_BY_ROLE[role]) || '/driver'
}
