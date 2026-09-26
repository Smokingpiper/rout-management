import { db } from '@/db/client'
import { routes, areas, spots, spotNotes, spotAssignments, users } from '@/db/schema'
import { and, asc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryCompany } from '@/lib/company'
import SpotBulkTable from './SpotBulkTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function RouteSpotsPage({
  params, searchParams,
}: {
  params: Promise<{ routeId: string }>
  searchParams: Promise<{ page?: string; q?: string; hasNote?: string; alertOnly?: string; driverId?: string }>
}) {
  const { routeId } = await params
  const { page: pageStr, q, hasNote, alertOnly, driverId } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const query = (q ?? '').trim()
  const hasNoteOnly = hasNote === '1'
  const alertSpotOnly = alertOnly === '1'

  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const noteMatches = (matchQuery: string) =>
    db.select({ n: sql`1` }).from(spotNotes).where(and(eq(spotNotes.spotId, spots.id), ilike(spotNotes.note, `%${matchQuery}%`)))
  const hasAnyNote = () =>
    db.select({ n: sql`1` }).from(spotNotes).where(eq(spotNotes.spotId, spots.id))
  const assignedToDriver = (userId: string) =>
    db.select({ n: sql`1` }).from(spotAssignments).where(and(eq(spotAssignments.spotId, spots.id), eq(spotAssignments.userId, userId)))

  const conditions = [eq(spots.routeId, routeId)]
  if (query) conditions.push(or(ilike(spots.address, `%${query}%`), exists(noteMatches(query)))!)
  if (hasNoteOnly) conditions.push(exists(hasAnyNote()))
  if (alertSpotOnly) conditions.push(eq(spots.isAlertSpot, true))
  if (driverId) conditions.push(exists(assignedToDriver(driverId)))
  const whereClause = and(...conditions)

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
  const noteBySpot: Record<string, string> = {}
  for (const n of notes) noteBySpot[n.spotId] = n.note

  const assignments = spotIds.length
    ? await db.select().from(spotAssignments).where(inArray(spotAssignments.spotId, spotIds))
    : []
  const assigneeCountBySpot: Record<string, number> = {}
  for (const a of assignments) assigneeCountBySpot[a.spotId] = (assigneeCountBySpot[a.spotId] ?? 0) + 1

  const company = await getPrimaryCompany()
  const driverList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id))
    : []

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const baseParams = {
    ...(query ? { q: query } : {}),
    ...(hasNoteOnly ? { hasNote: '1' } : {}),
    ...(alertSpotOnly ? { alertOnly: '1' } : {}),
    ...(driverId ? { driverId } : {}),
  }

  return (
    <>
      <div className="breadcrumb">
        <a href="/admin">エリア一覧</a> / <a href={`/admin/areas/${route.areaId}`}>{area?.name}</a> / {route.name}
      </div>
      <div className="page-title">{route.name} のスポット</div>
      <div className="page-desc">全{total.toLocaleString()}件。住所・備考で検索できます。要注意フラグはチェックですぐ保存されます。</div>

      <form method="get" className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: '1 1 240px' }} type="text" name="q" defaultValue={query} placeholder="住所・備考で検索（例: 上荻１丁目）" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
          <input type="checkbox" name="hasNote" value="1" defaultChecked={hasNoteOnly} />
          備考ありのみ
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
          <input type="checkbox" name="alertOnly" value="1" defaultChecked={alertSpotOnly} />
          要注意のみ
        </label>
        <select className="text-input" style={{ flex: '1 1 180px' }} name="driverId" defaultValue={driverId ?? ''}>
          <option value="">担当ドライバーで絞り込み…</option>
          {driverList.map(d => (
            <option key={d.id} value={d.id}>{d.name || d.email}</option>
          ))}
        </select>
        <button className="btn primary" type="submit">検索</button>
        {(query || hasNoteOnly || alertSpotOnly || driverId) && <a className="btn" href={`/admin/routes/${routeId}`}>クリア</a>}
      </form>

      <details className="card" open>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          スポット一覧（{total.toLocaleString()}件・タップで折りたたみ）
        </summary>
        <div style={{ marginTop: 12 }}>
          <SpotBulkTable
            routeId={routeId}
            spotList={spotList}
            noteBySpot={noteBySpot}
            assigneeCountBySpot={assigneeCountBySpot}
            driverList={driverList.map(d => ({ id: d.id, name: d.name, email: d.email }))}
          />
        </div>
      </details>

      <div className="pagination">
        <span>{page} / {totalPages} ページ</span>
        {page > 1 && <a className="btn" href={`?${new URLSearchParams({ ...baseParams, page: String(page - 1) })}`}>← 前へ</a>}
        {page < totalPages && <a className="btn" href={`?${new URLSearchParams({ ...baseParams, page: String(page + 1) })}`}>次へ →</a>}
      </div>
    </>
  )
}
