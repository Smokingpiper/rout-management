import { db } from '@/db/client'
import { areas, routes, spots, companies, users, userRoutes } from '@/db/schema'
import { eq, sql, inArray } from 'drizzle-orm'
import { getPrimaryCompany } from '@/lib/company'

export const dynamic = 'force-dynamic'

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; driverId?: string }>
}) {
  const { q, driverId } = await searchParams
  const query = (q ?? '').trim()

  let areaList = await db.select().from(areas)
  const companyList = await db.select().from(companies)
  const companyById = new Map(companyList.map(c => [c.id, c]))

  const company = await getPrimaryCompany()
  const driverList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id))
    : []

  if (query) {
    const lower = query.toLowerCase()
    areaList = areaList.filter(a => a.name.toLowerCase().includes(lower))
  }

  if (driverId) {
    const assigned = await db.select().from(userRoutes).where(eq(userRoutes.userId, driverId))
    const routeIds = assigned.map(a => a.routeId)
    const assignedRoutes = routeIds.length ? await db.select().from(routes).where(inArray(routes.id, routeIds)) : []
    const areaIdsWithDriver = new Set(assignedRoutes.map(r => r.areaId))
    areaList = areaList.filter(a => areaIdsWithDriver.has(a.id))
  }

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

      <form method="get" className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: '1 1 200px' }} type="text" name="q" defaultValue={query} placeholder="エリア名で検索" />
        <select className="text-input" style={{ flex: '1 1 180px' }} name="driverId" defaultValue={driverId ?? ''}>
          <option value="">担当ドライバーで絞り込み…</option>
          {driverList.map(d => (
            <option key={d.id} value={d.id}>{d.name || d.email}</option>
          ))}
        </select>
        <button className="btn primary" type="submit">検索</button>
        {(query || driverId) && <a className="btn" href="/admin">クリア</a>}
      </form>

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
        {areaList.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>該当するエリアがありません</p>
        )}
      </div>
    </>
  )
}
