import { db } from '@/db/client'
import { routes, areas, spots, spotNotes, spotAssignments, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryCompany } from '@/lib/company'
import SpotDetailForm from './SpotDetailForm'

export const dynamic = 'force-dynamic'

export default async function AdminSpotDetailPage({
  params,
}: {
  params: Promise<{ routeId: string; spotId: string }>
}) {
  const { routeId, spotId } = await params
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))
  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId))
  if (!spot) notFound()
  const [noteRow] = await db.select().from(spotNotes).where(eq(spotNotes.spotId, spotId))

  const company = await getPrimaryCompany()
  const driverList = company
    ? await db.select().from(users).where(eq(users.companyId, company.id))
    : []
  const assignedRows = await db.select().from(spotAssignments).where(eq(spotAssignments.spotId, spotId))
  const assignedUserIds = assignedRows.map(a => a.userId)

  return (
    <>
      <div className="breadcrumb">
        <a href="/admin">エリア一覧</a> / <a href={`/admin/areas/${route.areaId}`}>{area?.name}</a> / <a href={`/admin/routes/${routeId}`}>{route.name}</a> / #{spot.orderInRoute}
      </div>
      <div className="page-title">スポット #{spot.orderInRoute} の詳細</div>
      <SpotDetailForm
        spot={spot}
        initialNote={noteRow?.note ?? ''}
        routeId={routeId}
        driverList={driverList.map(d => ({ id: d.id, name: d.name, email: d.email }))}
        initialAssignedUserIds={assignedUserIds}
      />
    </>
  )
}
