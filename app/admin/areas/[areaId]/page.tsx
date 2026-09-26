import { db } from '@/db/client'
import { areas, routes, spots, wasteTypes, users, userRoutes } from '@/db/schema'
import { eq, sql, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryCompany } from '@/lib/company'
import RouteRow from './RouteRow'

export const dynamic = 'force-dynamic'

export default async function AreaRoutesPage({
  params, searchParams,
}: {
  params: Promise<{ areaId: string }>
  searchParams: Promise<{ q?: string; driverId?: string }>
}) {
  const { areaId } = await params
  const { q, driverId } = await searchParams
  const query = (q ?? '').trim()

  const [area] = await db.select().from(areas).where(eq(areas.id, areaId))
  if (!area) notFound()

  let routeList = await db.select().from(routes).where(eq(routes.areaId, areaId))

  if (query) {
    const lower = query.toLowerCase()
    routeList = routeList.filter(r => r.name.toLowerCase().includes(lower))
  }

  if (driverId) {
    const assigned = await db.select().from(userRoutes).where(eq(userRoutes.userId, driverId))
    const assignedRouteIds = new Set(assigned.map(a => a.routeId))
    routeList = routeList.filter(r => assignedRouteIds.has(r.id))
  }

  const spotCounts = await db
    .select({ routeId: spots.routeId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .groupBy(spots.routeId)
  const spotCountByRoute = new Map(spotCounts.map(r => [r.routeId, r.n]))

  const wasteTypeList = await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, area.companyId))

  const company = await getPrimaryCompany()
  const driverList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id))
    : []

  return (
    <>
      <div className="breadcrumb"><a href="/admin">エリア一覧</a> / {area.name}</div>
      <div className="page-title">{area.name} のルート</div>
      <div className="page-desc">ルート名をクリックするとスポット一覧を確認・編集できます。ゴミ種別はここで変更できます。</div>

      <form method="get" className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: '1 1 200px' }} type="text" name="q" defaultValue={query} placeholder="ルート名で検索" />
        <select className="text-input" style={{ flex: '1 1 180px' }} name="driverId" defaultValue={driverId ?? ''}>
          <option value="">担当ドライバーで絞り込み…</option>
          {driverList.map(d => (
            <option key={d.id} value={d.id}>{d.name || d.email}</option>
          ))}
        </select>
        <button className="btn primary" type="submit">検索</button>
        {(query || driverId) && <a className="btn" href={`/admin/areas/${areaId}`}>クリア</a>}
      </form>

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
            {routeList.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>該当するルートがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
