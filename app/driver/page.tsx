import { db } from '@/db/client'
import { areas, routes, wasteTypes, dailyReports, spots } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { todayStr } from '@/lib/date'

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

export default async function DriverRouteListPage() {
  const today = todayStr()

  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const routeList = await db.select().from(routes)
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))

  const todaysReports = await db.select().from(dailyReports).where(eq(dailyReports.reportDate, today))
  const reportByRoute = new Map(todaysReports.map(r => [r.routeId, r]))

  const spotCounts = await db
    .select({ routeId: spots.routeId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .groupBy(spots.routeId)
  const spotCountByRoute = new Map(spotCounts.map(r => [r.routeId, r.n]))

  const sorted = [...routeList].sort((a, b) => {
    const areaA = areaById.get(a.areaId)?.name ?? ''
    const areaB = areaById.get(b.areaId)?.name ?? ''
    return areaA.localeCompare(areaB, 'ja') || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">ルート一覧</div>
      <div className="page-desc">担当するルートを選んで開始してください。今日すでに開始したルートは状態が表示されます。</div>

      {sorted.map(route => {
        const report = reportByRoute.get(route.id)
        const wt = route.defaultWasteTypeId ? wasteTypeById.get(route.defaultWasteTypeId) : null
        return (
          <a key={route.id} className="route-item" href={`/driver/routes/${route.id}`}>
            <div className="name">{areaById.get(route.areaId)?.name} — {route.name}</div>
            <div className="meta">
              {wt?.name ?? '品目未設定'} ・ スポット{(spotCountByRoute.get(route.id) ?? 0).toLocaleString()}件
              {report && (
                <span className={`pill ${STATUS_CLASS[report.status]}`} style={{ marginLeft: 8 }}>
                  {STATUS_LABEL[report.status]}
                </span>
              )}
            </div>
          </a>
        )
      })}
    </>
  )
}
