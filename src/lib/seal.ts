// 会社管理者のランク。紙の日報の押印欄「課長・係長・担当者」に対応する
export const ADMIN_RANKS = [
  { value: 'manager', label: '課長' },
  { value: 'chief', label: '係長' },
] as const
export type AdminRank = typeof ADMIN_RANKS[number]['value']

export function rankLabel(rank: string | null | undefined): string | null {
  return ADMIN_RANKS.find(r => r.value === rank)?.label ?? null
}

type SealUser = { sealName?: string | null; name?: string | null; email?: string | null }

// 電子印鑑に入れる文字。指定があればそれ、無ければ氏名の姓（スペース区切りの先頭）、
// スペースが無い氏名は先頭2文字、氏名が無ければメールアドレスの先頭2文字。最大4文字
export function sealTextFor(user: SealUser | null | undefined): string {
  if (!user) return ''
  const explicit = user.sealName?.trim()
  if (explicit) return Array.from(explicit).slice(0, 4).join('')
  const name = user.name?.trim()
  if (name) {
    const surname = name.split(/[\s　]+/)[0]
    const base = surname !== name ? surname : Array.from(name).slice(0, 2).join('')
    return Array.from(base).slice(0, 4).join('')
  }
  return Array.from(user.email?.split('@')[0] ?? '').slice(0, 2).join('')
}

export function formatStampDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }).formatToParts(d)
  const m = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${m}/${day}`
}
