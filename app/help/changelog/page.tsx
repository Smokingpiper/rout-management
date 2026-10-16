import { CHANGELOG, AUDIENCE_LABEL, KIND_LABEL, type ChangeAudience } from '@/lib/changelog'
import { todayStr } from '@/lib/date'

export const dynamic = 'force-dynamic'

const FILTERS: { value: '' | ChangeAudience; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'driver', label: 'ドライバー' },
  { value: 'admin', label: '会社管理者' },
  { value: 'union', label: '協会管理者' },
]
const KIND_STYLE: Record<string, { bg: string; fg: string }> = {
  new: { bg: 'var(--accent-dim)', fg: 'var(--accent)' },
  improve: { bg: 'var(--accent-2-dim)', fg: 'var(--accent-2)' },
  fix: { bg: 'var(--warn-dim)', fg: 'var(--warn)' },
}
const NEW_WITHIN_DAYS = 7

function daysAgo(ymd: string, today: string) {
  return Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${ymd}T12:00:00Z`).getTime()) / 86400000)
}

export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forParam } = await searchParams
  const filter = FILTERS.some(f => f.value === forParam) ? (forParam as ChangeAudience | '') : ''
  const today = todayStr()

  // 絞り込み時は、その役割向けの項目と「全員向け」の項目を表示する
  const entries = CHANGELOG
    .map(e => ({ ...e, items: e.items.filter(i => !filter || i.audience === filter || i.audience === 'all') }))
    .filter(e => e.items.length > 0)

  return (
    <>
      <div className="breadcrumb"><a href="/help">使い方</a> / 更新履歴</div>
      <div className="page-title">📝 更新履歴</div>
      <div className="page-desc">アプリに追加・変更された機能と修正の一覧です（新しい順）。使い方の詳細は「使い方」を見てください。</div>

      <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>表示する対象：</span>
        {FILTERS.map(f => (
          <a
            key={f.value}
            className={`btn sm ${filter === f.value ? 'primary' : ''}`}
            href={f.value ? `/help/changelog?for=${f.value}` : '/help/changelog'}
          >
            {f.label}
          </a>
        ))}
      </div>

      {entries.map(entry => {
        const isNew = daysAgo(entry.date, today) <= NEW_WITHIN_DAYS
        return (
          <div className="card" key={entry.date}>
            <div className="card-title">
              <span>{entry.date}　{entry.title}</span>
              {isNew && <span className="pill" style={{ background: 'var(--danger)', color: '#fff' }}>NEW</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entry.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.7 }}>
                  <span className="pill" style={{ background: KIND_STYLE[item.kind].bg, color: KIND_STYLE[item.kind].fg, flexShrink: 0, minWidth: 48, justifyContent: 'center' }}>
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="pill muted" style={{ flexShrink: 0 }}>{AUDIENCE_LABEL[item.audience]}</span>
                  <span style={{ color: 'var(--text-2)' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {entries.length === 0 && <div className="card"><p style={{ fontSize: 13, color: 'var(--text-3)' }}>該当する更新はありません。</p></div>}
    </>
  )
}
