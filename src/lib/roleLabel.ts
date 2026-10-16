import { rankLabel } from './seal'

export const ROLE_LABEL: Record<string, string> = {
  union_admin: '協会管理者',
  company_admin: '会社管理者',
  driver: 'ドライバー',
}

// 会社管理者はランク（課長/係長）が設定されていれば「会社管理者（課長）」のように表示する
export function formatRoles(roles: string[] | null | undefined, adminRank?: string | null): string {
  const list = roles ?? []
  if (list.length === 0) return '—'
  return list
    .map(r => {
      const label = ROLE_LABEL[r] ?? r
      const rank = r === 'company_admin' ? rankLabel(adminRank) : null
      return rank ? `${label}（${rank}）` : label
    })
    .join('・')
}
