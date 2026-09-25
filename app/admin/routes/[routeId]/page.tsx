import { db } from '@/db/client'
import { routes, areas, spots, spotNotes } from '@/db/schema'
import { and, asc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import SpotRow from './SpotRow'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function RouteSpotsPage({
  params, searchParams,
}: {
  params: Promise<{ routeId: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { routeId } = await params
  const { page: pageStr, q } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const query = (q ?? '').trim()

  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const whereClause = query
    ? and(eq(spots.routeId, routeId), ilike(spots.address, `%${query}%`))
    : eq(spots.routeId, routeId)

  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .where(whereClause)

  const spotList = await db
    .select()
    .from(spots)
    .where(whereClause)
    .orderBy(asc(spots.orderInRoute))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const spotIds = spotList.map(s => s.id)
  const notes = spotIds.length
    ? await db.select().from(spotNotes).where(inArray(spotNotes.spotId, spotIds))
    : []
  const notesBySpot = new Map<string, string[]>()
  for (const n of notes) {
    const arr = notesBySpot.get(n.spotId) ?? []
    arr.push(n.note)
    notesBySpot.set(n.spotId, arr)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <div className="breadcrumb">
        <a href="/admin">エリア一覧</a> / <a href={`/admin/areas/${route.areaId}`}>{area?.name}</a> / {route.name}
      </div>
      <div className="page-title">{route.name} のスポット</div>
      <div className="page-desc">全{total.toLocaleString()}件。住所で検索できます。要注意フラグはチェックですぐ保存されます。</div>

      <form method="get" className="card" style={{ display: 'flex', gap: 10 }}>
        <input className="search-input" style={{ flex: 1 }} type="text" name="q" defaultValue={query} placeholder="住所で検索（例: 上荻１丁目）" />
        <button className="btn primary" type="submit">検索</button>
        {query && <a className="btn" href={`/admin/routes/${routeId}`}>クリア</a>}
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>住所</th>
              <th>緯度・経度</th>
              <th>備考</th>
              <th className="checkbox-cell">要注意</th>
            </tr>
          </thead>
          <tbody>
            {spotList.map(spot => (
              <SpotRow key={spot.id} spot={spot} notes={notesBySpot.get(spot.id) ?? []} />
            ))}
            {spotList.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>該当するスポットがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{page} / {totalPages} ページ</span>
        {page > 1 && <a className="btn" href={`?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) })}`}>← 前へ</a>}
        {page < totalPages && <a className="btn" href={`?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) })}`}>次へ →</a>}
      </div>
    </>
  )
}
