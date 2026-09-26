import { db } from '@/db/client'
import { areas, routes, dailyReports, userRoutes } from '@/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}
const STATUS_CLASS: Record<string, string> = {
  in_progress: 'info',
  pending_approval: 'warn',
  approved: 'ok',
}

export default async function DriverReportsPage() {
  const user = await getCurrentUser()

  const myAssignments = user
    ? await db.select().from(userRoutes).where(eq(userRoutes.userId, user.id))
    : []
  const routeIds = [...new Set(myAssignments.map(a => a.routeId))]

  const reportList = routeIds.length
    ? await db.select().from(dailyReports).where(inArray(dailyReports.routeId, routeIds)).orderBy(desc(dailyReports.reportDate))
    : []

  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const routeList = routeIds.length ? await db.select().from(routes).where(inArray(routes.id, routeIds)) : []
  const routeById = new Map(routeList.map(r => [r.id, r]))

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">日報一覧</div>
      <div className="page-desc">あなたの担当ルートの日報です。</div>

      <div className="card">
        <table>
          <thead>
            <tr><th>日付</th><th>ルート</th><th>状態</th><th></th></tr>
          </thead>
          <tbody>
            {reportList.map(r => {
              const route = routeById.get(r.routeId)
              return (
                <tr key={r.id}>
                  <td>{r.reportDate}</td>
                  <td>{route ? `${areaById.get(route.areaId)?.name} — ${route.name}` : '—'}</td>
                  <td><span className={`pill ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td><a className="btn sm" href={`/driver/reports/${r.id}`}>詳細</a></td>
                </tr>
              )
            })}
            {reportList.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだ日報がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
