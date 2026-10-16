import { db } from '@/db/client'
import { dailyInspections, users } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { SHIFT_TYPES, summarizeInspection } from '@/lib/inspection'

export const dynamic = 'force-dynamic'

const SHIFT_LABEL = Object.fromEntries(SHIFT_TYPES.map(s => [s.value, s.label])) as Record<string, string>

export default async function AdminInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string }>
}) {
  const { q, date } = await searchParams
  const query = (q ?? '').trim()
  const dateFilter = (date ?? '').trim()

  const userList = await db.select().from(users)
  const userById = new Map(userList.map(u => [u.id, u]))

  let rows = await db.select().from(dailyInspections).orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.updatedAt)).limit(300)
  if (dateFilter) rows = rows.filter(r => r.inspectionDate === dateFilter)
  if (query) {
    rows = rows.filter(r => {
      const u = userById.get(r.userId)
      return (u?.name ?? '').includes(query) || (u?.email ?? '').includes(query) || (r.vehicleNumber ?? '').includes(query)
    })
  }

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">点検記録</div>
      <div className="page-desc">ドライバーが入力した作業前点検（日常点検・点呼表）の一覧です。×の項目や点呼の異常がある記録は目立つように表示されます。</div>

      <form method="get" className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: '1 1 200px' }} type="text" name="q" defaultValue={query} placeholder="ドライバー名・車両番号で検索" />
        <input className="text-input" type="date" name="date" defaultValue={dateFilter} />
        <button className="btn primary" type="submit">検索</button>
        {(query || dateFilter) && <a className="btn" href="/admin/inspections">クリア</a>}
      </form>

      <div className="card">
        {rows.map(r => {
          const u = userById.get(r.userId)
          const s = summarizeInspection(r)
          const hasProblem = s.ngItems.length > 0 || s.alerts.length > 0
          return (
            <div
              key={r.id}
              className="spot-row"
              style={{
                flexWrap: 'wrap', justifyContent: 'space-between', gap: 10,
                ...(hasProblem ? { borderLeft: '3px solid var(--danger)', paddingLeft: 10 } : {}),
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {r.inspectionDate} ・ {u?.name || u?.email || '（不明なユーザー）'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {r.vehicleNumber || '車両番号未入力'} ・ {SHIFT_LABEL[r.shiftType] ?? r.shiftType}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span className={`pill ${s.checksDone ? 'ok' : 'warn'}`}>点検 {s.answered}/{s.total}</span>
                  <span className={`pill ${s.startDone ? 'ok' : 'muted'}`}>始業点呼 {s.startDone ? '済' : '未'}</span>
                  <span className={`pill ${s.endDone ? 'ok' : 'muted'}`}>終業点呼 {s.endDone ? '済' : '未'}</span>
                  {s.ngItems.length > 0 && <span className="pill" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>× {s.ngItems.length}件</span>}
                  {s.alerts.length > 0 && <span className="pill" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>点呼に要確認あり</span>}
                  {r.nearMissNote && <span className="pill info">ヒヤリハット記載あり</span>}
                </div>
              </div>
              <a className="btn sm" href={`/admin/inspections/${r.id}`}>詳細</a>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0', fontSize: 13 }}>該当する点検記録がありません</p>
        )}
      </div>
    </>
  )
}
