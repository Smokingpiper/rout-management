import { db } from '@/db/client'
import { areas, routes, wasteTypes, dailyReports, spots, userRoutes } from '@/db/schema'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { todayStr, todayDayOfWeek } from '@/lib/date'
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
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default async function TodayRoutePage() {
  const user = await getCurrentUser()
  const today = todayStr()
  const dow = todayDayOfWeek()

  const myAssignments = user
    ? await db.select().from(userRoutes).where(eq(userRoutes.userId, user.id))
    : []
  const todaysRouteIds = myAssignments
    .filter(a => (a.daysOfWeek as number[]).includes(dow))
    .map(a => a.routeId)

  const routeList = todaysRouteIds.length
    ? await db.select().from(routes).where(inArray(routes.id, todaysRouteIds))
    : []
  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))

  const todaysReports = routeList.length
    ? await db.select().from(dailyReports).where(and(eq(dailyReports.reportDate, today), inArray(dailyReports.routeId, todaysRouteIds)))
    : []
  const reportByRoute = new Map(todaysReports.map(r => [r.routeId, r]))

  const spotCounts = routeList.length
    ? await db.select({ routeId: spots.routeId, n: sql<number>`count(*)`.mapWith(Number) }).from(spots).where(inArray(spots.routeId, todaysRouteIds)).groupBy(spots.routeId)
    : []
  const spotCountByRoute = new Map(spotCounts.map(r => [r.routeId, r.n]))

  const sorted = [...routeList].sort((a, b) => {
    const areaA = areaById.get(a.areaId)?.name ?? ''
    const areaB = areaById.get(b.areaId)?.name ?? ''
    return areaA.localeCompare(areaB, 'ja') || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">今日のルート（{today}・{DAY_LABELS[dow]}曜日）</div>
      <div className="page-desc">本日担当のルートです。ルートを選んで収集を開始してください。</div>

      {sorted.map(route => {
        const report = reportByRoute.get(route.id)
        const wt = route.defaultWasteTypeId ? wasteTypeById.get(route.defaultWasteTypeId) : null
        return (
          <div key={route.id} className="card">
            <div className="name" style={{ fontWeight: 700, marginBottom: 4 }}>{areaById.get(route.areaId)?.name} — {route.name}</div>
            <div className="meta" style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
              {wt?.name ?? '品目未設定'} ・ スポット{(spotCountByRoute.get(route.id) ?? 0).toLocaleString()}件
              {report && (
                <span className={`pill ${STATUS_CLASS[report.status]}`} style={{ marginLeft: 8 }}>
                  {STATUS_LABEL[report.status]}
                </span>
              )}
            </div>
            <div className="grid-cards" style={{ gridTemplateColumns: report?.status === 'in_progress' || !report ? '1fr 1fr 1fr' : '1fr 1fr' }}>
              <a className="btn primary" href={`/driver/routes/${route.id}`}>{report ? '続ける →' : '収集を開始する →'}</a>
              <a className="btn" href={`/driver/routes/${route.id}/track`}>🛰 軌跡マップ</a>
              {(report?.status === 'in_progress' || !report) && (
                <a className="btn" href={`/driver/routes/${route.id}/submit`}>📝 日報提出</a>
              )}
            </div>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>本日（{DAY_LABELS[dow]}曜日）に担当のルートはありません。</p>
        </div>
      )}

      <a className="btn" href="/driver/my-routes">📋 担当ルート一覧を見る</a>
    </>
  )
}
