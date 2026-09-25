import { db } from '@/db/client'
import { areas, routes, spots, companies } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function AreasPage() {
  const areaList = await db.select().from(areas)
  const companyList = await db.select().from(companies)
  const companyById = new Map(companyList.map(c => [c.id, c]))

  const routeCounts = await db
    .select({ areaId: routes.areaId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(routes)
    .groupBy(routes.areaId)
  const routeCountByArea = new Map(routeCounts.map(r => [r.areaId, r.n]))

  const spotCounts = await db
    .select({ areaId: routes.areaId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(routes, eq(spots.routeId, routes.id))
    .groupBy(routes.areaId)
  const spotCountByArea = new Map(spotCounts.map(r => [r.areaId, r.n]))

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">エリア一覧</div>
      <div className="page-desc">エリアを選ぶとルート一覧、ルートを選ぶとスポット一覧を確認・編集できます。</div>

      <div className="grid-cards">
        {areaList.map(area => (
          <a key={area.id} className="stat-card" href={`/admin/areas/${area.id}`}>
            <div className="name">{area.name}</div>
            <div className="meta">
              {companyById.get(area.companyId)?.name ?? '—'}<br />
              ルート {routeCountByArea.get(area.id) ?? 0}件 ・ スポット {spotCountByArea.get(area.id) ?? 0}件
            </div>
          </a>
        ))}
      </div>
    </>
  )
}
