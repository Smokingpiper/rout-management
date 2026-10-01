export const ROLE_LABEL: Record<string, string> = {
  union_admin: '協会管理者',
  company_admin: '会社管理者',
  driver: 'ドライバー',
}

export function formatRoles(roles: string[] | null | undefined): string {
  const list = roles ?? []
  if (list.length === 0) return '—'
  return list.map(r => ROLE_LABEL[r] ?? r).join('・')
}
