import { db } from '@/db/client'
import { areas, routes, wasteTypes, dailyReports, spots, userRoutes, dailyInspections } from '@/db/schema'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { todayStr, todayDayOfWeek } from '@/lib/date'
import { getCurrentUser } from '@/lib/auth'
import { summarizeInspection } from '@/lib/inspection'

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

export default async function TodayRoutePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
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

  // 今日の作業前点検（通常と早朝は別々）。点検項目と始業点呼がそろっていれば開始できる
  const inspections = user
    ? await db.select().from(dailyInspections).where(and(eq(dailyInspections.userId, user.id), eq(dailyInspections.inspectionDate, today)))
    : []
  const readyFor = (shift: 'normal' | 'early') => {
    const rec = inspections.find(i => i.shiftType === shift)
    const s = rec ? summarizeInspection(rec) : null
    return { summary: s, ready: !!s && s.checksDone && s.startDone }
  }
  const normal = readyFor('normal')
  const early = readyFor('early')

  const [earlyReport] = user
    ? await db.select().from(dailyReports).where(and(
        eq(dailyReports.collectionType, 'early'),
        eq(dailyReports.reportDate, today),
        eq(dailyReports.startedBy, user.id),
      ))
    : []

  const sorted = [...routeList].sort((a, b) => {
    const areaA = areaById.get(a.areaId)?.name ?? ''
    const areaB = areaById.get(b.areaId)?.name ?? ''
    return areaA.localeCompare(areaB, 'ja') || a.name.localeCompare(b.name, 'ja')
  })

  const inspectionPill = (r: ReturnType<typeof readyFor>) => r.ready
    ? <span className="pill ok">点検済</span>
    : <span className="pill warn">点検未完了{r.summary ? `（${r.summary.answered}/${r.summary.total}）` : ''}</span>

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">今日のルート（{today}・{DAY_LABELS[dow]}曜日）</div>
      <div className="page-desc">回収の種類を選んでください。作業前点検（日常点検・点呼）を済ませると、回収が始まりGPS記録も自動でONになります。</div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <a className="btn primary" style={{ width: '100%', minHeight: 56, fontSize: 16 }} href="/driver/begin?type=normal">🚚 通常回収</a>
          <div style={{ fontSize: 12, color: 'var(--text-2)', margin: '8px 0 6px' }}>本日の担当ルート {sorted.length}件</div>
          {inspectionPill(normal)}
          <div style={{ marginTop: 8 }}><a href="/driver/inspection?type=normal" style={{ fontSize: 11.5, color: 'var(--accent-2)' }}>点検内容を開く</a></div>
        </div>
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <a className="btn primary" style={{ width: '100%', minHeight: 56, fontSize: 16, background: 'var(--accent-2)', borderColor: 'var(--accent-2)' }} href="/driver/begin?type=early">🌅 早朝回収</a>
          <div style={{ fontSize: 12, color: 'var(--text-2)', margin: '8px 0 6px' }}>
            ルートなし・自由にスポットを回る
            {earlyReport && <span className={`pill ${STATUS_CLASS[earlyReport.status]}`} style={{ marginLeft: 6 }}>{STATUS_LABEL[earlyReport.status]}</span>}
          </div>
          {inspectionPill(early)}
          <div style={{ marginTop: 8 }}><a href="/driver/inspection?type=early" style={{ fontSize: 11.5, color: 'var(--accent-2)' }}>点検内容を開く</a></div>
        </div>
      </div>

      {/* 担当ルートの一覧は、［通常回収］を選んで点検を済ませたあと（担当ルートが複数ある日）にだけ表示する。
          トップは［通常回収］［早朝回収］の2択に絞る */}
      {type === 'normal' && (
      <>
      <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 8px' }}>
        本日の担当ルート（通常回収）
        {sorted.length > 0 && <span className="pill info" style={{ marginLeft: 8 }}>回収するルートを選んでください</span>}
      </div>

      {sorted.map(route => {
        const startHref = `/driver/routes/${route.id}?start=1`
        const needsInspection = !normal.ready
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
              <a
                className="btn primary"
                href={needsInspection ? `/driver/inspection?type=normal&next=${encodeURIComponent(startHref)}` : report ? `/driver/routes/${route.id}` : startHref}
              >
                {needsInspection ? (report ? '点検して続ける →' : '点検して収集を開始する →') : report ? '続ける →' : '収集を開始する →'}
              </a>
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
      </>
      )}

      <a className="btn" href="/driver/my-routes">📋 担当ルート一覧を見る</a>
    </>
  )
}
