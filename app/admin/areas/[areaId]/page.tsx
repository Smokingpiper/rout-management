import { db } from '@/db/client'
import { areas, routes, spots, wasteTypes } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import RouteRow from './RouteRow'

export const dynamic = 'force-dynamic'

export default async function AreaRoutesPage({ params }: { params: Promise<{ areaId: string }> }) {
  const { areaId } = await params
  const [area] = await db.select().from(areas).where(eq(areas.id, areaId))
  if (!area) notFound()

  const routeList = await db.select().from(routes).where(eq(routes.areaId, areaId))

  const spotCounts = await db
    .select({ routeId: spots.routeId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .groupBy(spots.routeId)
  const spotCountByRoute = new Map(spotCounts.map(r => [r.routeId, r.n]))

  const wasteTypeList = await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, area.companyId))

  return (
    <>
      <div className="breadcrumb"><a href="/admin">エリア一覧</a> / {area.name}</div>
      <div className="page-title">{area.name} のルート</div>
      <div className="page-desc">ルート名をクリックするとスポット一覧を確認・編集できます。ゴミ種別はここで変更できます。</div>

      <div className="card">
        <table>
          <thead>
            <tr><th>ルート名</th><th>ゴミ種別</th><th>スポット数</th><th></th></tr>
          </thead>
          <tbody>
            {routeList.map(route => (
              <RouteRow
                key={route.id}
                route={route}
                spotCount={spotCountByRoute.get(route.id) ?? 0}
                wasteTypeList={wasteTypeList}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
