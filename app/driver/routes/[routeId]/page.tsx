import { db } from '@/db/client'
import { routes, areas, spots, spotNotes, spotAlertAcknowledgments, routeTrackPoints, wasteTypes } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getOrCreateTodaysReport } from '@/lib/daily-report'
import { getCurrentUser } from '@/lib/auth'
import { filterSpotsForDriver } from '@/lib/driverSpots'
import RunScreen from './RunScreen'

export const dynamic = 'force-dynamic'

export default async function DriverRoutePage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const report = await getOrCreateTodaysReport(routeId)

  const allSpots = await db.select().from(spots).where(eq(spots.routeId, routeId)).orderBy(spots.orderInRoute)
  const user = await getCurrentUser()
  const spotList = user ? await filterSpotsForDriver(allSpots, user.id) : allSpots
  const alertSpotIds = spotList.filter(s => s.isAlertSpot).map(s => s.id)

  const spotIds = spotList.map(s => s.id)
  const notes = spotIds.length
    ? await db.select().from(spotNotes).where(inArray(spotNotes.spotId, spotIds))
    : []
  const hasNoteSpotIds = new Set(notes.map(n => n.spotId))
  const spotListWithNotes = spotList.map(s => ({ ...s, hasNote: hasNoteSpotIds.has(s.id) }))

  const acks = alertSpotIds.length
    ? await db.select().from(spotAlertAcknowledgments).where(and(
        eq(spotAlertAcknowledgments.dailyReportId, report.id),
        inArray(spotAlertAcknowledgments.spotId, alertSpotIds),
      ))
    : []
  const ackedSpotIds = new Set(acks.map(a => a.spotId))

  const [{ n: trackPointCount }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(routeTrackPoints)
    .where(eq(routeTrackPoints.dailyReportId, report.id))

  const wasteType = report.wasteTypeId
    ? (await db.select().from(wasteTypes).where(eq(wasteTypes.id, report.wasteTypeId)))[0]
    : null

  return (
    <RunScreen
      routeId={routeId}
      routeName={`${area?.name ?? ''} — ${route.name}`}
      report={report}
      spots={spotListWithNotes}
      ackedSpotIds={[...ackedSpotIds]}
      trackPointCount={trackPointCount}
      wasteTypeName={wasteType?.name ?? null}
    />
  )
}
