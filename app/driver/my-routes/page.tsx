import { db } from '@/db/client'
import { areas, routes, wasteTypes, spots, userRoutes } from '@/db/schema'
import { eq, sql, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default async function MyRoutesPage() {
  const user = await getCurrentUser()

  const myAssignments = user
    ? await db.select().from(userRoutes).where(eq(userRoutes.userId, user.id))
    : []
  const routeIds = myAssignments.map(a => a.routeId)
  const daysByRoute = new Map(myAssignments.map(a => [a.routeId, (a.daysOfWeek as number[]).slice().sort()]))

  const routeList = routeIds.length ? await db.select().from(routes).where(inArray(routes.id, routeIds)) : []
  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))

  const spotCounts = routeIds.length
    ? await db.select({ routeId: spots.routeId, n: sql<number>`count(*)`.mapWith(Number) }).from(spots).where(inArray(spots.routeId, routeIds)).groupBy(spots.routeId)
    : []
  const spotCountByRoute = new Map(spotCounts.map(r => [r.routeId, r.n]))

  const sorted = [...routeList].sort((a, b) => {
    const areaA = areaById.get(a.areaId)?.name ?? ''
    const areaB = areaById.get(b.areaId)?.name ?? ''
    return areaA.localeCompare(areaB, 'ja') || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <>
      <div className="breadcrumb"><a href="/driver">今日のルート</a> / 担当ルート一覧</div>
      <div className="page-title">担当ルート一覧</div>
      <div className="page-desc">曜日に関係なく、あなたが担当しているルートをすべて表示しています。</div>

      {sorted.map(route => {
        const wt = route.defaultWasteTypeId ? wasteTypeById.get(route.defaultWasteTypeId) : null
        const days = daysByRoute.get(route.id) ?? []
        return (
          <a key={route.id} className="route-item" href={`/driver/routes/${route.id}`}>
            <div className="name">{areaById.get(route.areaId)?.name} — {route.name}</div>
            <div className="meta">
              {wt?.name ?? '品目未設定'} ・ スポット{(spotCountByRoute.get(route.id) ?? 0).toLocaleString()}件
              <span style={{ marginLeft: 8 }}>
                {days.length > 0 ? days.map(d => DAY_LABELS[d]).join('・') : '曜日未設定'}
              </span>
            </div>
          </a>
        )
      })}

      {sorted.length === 0 && (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ担当ルートが設定されていません。会社管理者にご確認ください。</p>
        </div>
      )}
    </>
  )
}
