import { db } from '@/db/client'
import { routes, areas, spots, spotNotes, spotAlertAcknowledgments, routeTrackPoints } from '@/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getOrCreateTodaysReport } from '@/lib/daily-report'
import SpotNavScreen from './SpotNavScreen'

export const dynamic = 'force-dynamic'

export default async function SpotNavPage({ params }: { params: Promise<{ routeId: string; spotId: string }> }) {
  const { routeId, spotId } = await params
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const spotList = await db.select().from(spots).where(eq(spots.routeId, routeId)).orderBy(asc(spots.orderInRoute))
  const index = spotList.findIndex(s => s.id === spotId)
  if (index === -1) notFound()
  const spot = spotList[index]
  const prevSpot = spotList[index - 1] ?? null
  const nextSpot = spotList[index + 1] ?? null

  const report = await getOrCreateTodaysReport(routeId)

  let acked = false
  if (spot.isAlertSpot) {
    const [ack] = await db.select().from(spotAlertAcknowledgments).where(and(
      eq(spotAlertAcknowledgments.dailyReportId, report.id),
      eq(spotAlertAcknowledgments.spotId, spot.id),
    ))
    acked = !!ack
  }

  const [{ n: trackPointCount }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(routeTrackPoints)
    .where(eq(routeTrackPoints.dailyReportId, report.id))

  const notes = await db.select().from(spotNotes).where(eq(spotNotes.spotId, spot.id))
  const note = notes.map(n => n.note).join(' / ') || null

  return (
    <SpotNavScreen
      routeId={routeId}
      routeName={`${area?.name ?? ''} — ${route.name}`}
      spot={spot}
      note={note}
      index={index}
      total={spotList.length}
      prevSpotId={prevSpot?.id ?? null}
      nextSpotId={nextSpot?.id ?? null}
      report={report}
      initiallyAcked={acked}
      trackPointCount={trackPointCount}
    />
  )
}
