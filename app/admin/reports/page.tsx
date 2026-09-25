import { db } from '@/db/client'
import { dailyReports, routes, areas, wasteTypes } from '@/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}
const STATUS_CLASS: Record<string, string> = {
  in_progress: 'muted',
  pending_approval: 'warn',
  approved: 'ok',
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim()

  const routeList = await db.select().from(routes)
  const routeById = new Map(routeList.map(r => [r.id, r]))
  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))

  let reportList = await db.select().from(dailyReports).orderBy(desc(dailyReports.reportDate)).limit(200)

  if (query) {
    const matchRouteIds = new Set(
      routeList.filter(r => r.name.includes(query) || (areaById.get(r.areaId)?.name.includes(query))).map(r => r.id)
    )
    reportList = reportList.filter(r => matchRouteIds.has(r.routeId))
  }

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">日報一覧・承認</div>
      <div className="page-desc">ドライバーが提出した日報を確認・承認します。総重量・種別は1日1件、軌跡は詳細画面で確認できます。</div>

      <form method="get" className="card" style={{ display: 'flex', gap: 10 }}>
        <input className="search-input" style={{ flex: 1 }} type="text" name="q" defaultValue={query} placeholder="ルート名・エリア名で検索" />
        <button className="btn primary" type="submit">検索</button>
        {query && <a className="btn" href="/admin/reports">クリア</a>}
      </form>

      <div className="card">
        <table>
          <thead>
            <tr><th>日付</th><th>エリア</th><th>ルート</th><th>種別</th><th>総重量</th><th>状態</th><th></th></tr>
          </thead>
          <tbody>
            {reportList.map(r => {
              const route = routeById.get(r.routeId)
              const area = route ? areaById.get(route.areaId) : null
              const wt = r.wasteTypeId ? wasteTypeById.get(r.wasteTypeId) : null
              return (
                <tr key={r.id}>
                  <td>{r.reportDate}</td>
                  <td>{area?.name ?? '—'}</td>
                  <td>{route?.name ?? '—'}</td>
                  <td>{wt?.name ?? '—'}</td>
                  <td>{r.totalWeightKg != null ? `${r.totalWeightKg}kg` : '—'}</td>
                  <td><span className={`pill ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td><a className="btn sm" href={`/admin/reports/${r.id}`}>詳細</a></td>
                </tr>
              )
            })}
            {reportList.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだ日報がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
