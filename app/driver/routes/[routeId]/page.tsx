import { db } from '@/db/client'
import { routes, areas, spots, spotNotes, spotAlertAcknowledgments, routeTrackPoints, wasteTypes } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getOrCreateTodaysReport } from '@/lib/daily-report'
import { getCurrentUser } from '@/lib/auth'
import { filterSpotsForDriver } from '@/lib/driverSpots'
import { requireInspectionForPatrol } from '@/lib/inspectionGate'
import { findMissedSpots } from '@/lib/missedSpots'
import { topLevelTypes } from '@/lib/wasteTypes'
import RunScreen from './RunScreen'

export const dynamic = 'force-dynamic'

export default async function DriverRoutePage({
  params, searchParams,
}: {
  params: Promise<{ routeId: string }>
  searchParams: Promise<{ start?: string }>
}) {
  const { routeId } = await params
  const { start } = await searchParams
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const report = await getOrCreateTodaysReport(routeId)
  const user = await getCurrentUser()
  await requireInspectionForPatrol(user?.id, routeId, report.status)

  const allSpots = await db.select().from(spots).where(eq(spots.routeId, routeId)).orderBy(spots.orderInRoute)
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

  // これまでに記録されたGPS軌跡から「通過済み」のスポットを求める。
  // 画面を開き直した・再読み込みしたときも、緑（通過済み）の状態を引き継ぐため
  const trackPoints = await db
    .select({ lat: routeTrackPoints.latitude, lng: routeTrackPoints.longitude })
    .from(routeTrackPoints)
    .where(eq(routeTrackPoints.dailyReportId, report.id))
  const missedIds = new Set(findMissedSpots(spotList, trackPoints).map(s => s.id))
  const visitedSpotIds = spotList.filter(s => !missedIds.has(s.id)).map(s => s.id)

  // 収集物（大分類）の選択肢は、そのルートの会社のもの
  const companyWasteTypes = area ? await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, area.companyId)) : []

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
      initialVisitedSpotIds={visitedSpotIds}
      trackPointCount={trackPointCount}
      wasteTypeName={wasteType?.name ?? null}
      wasteTypeOptions={topLevelTypes(companyWasteTypes).map(w => ({ id: w.id, name: w.name }))}
      autoStartRecording={start === '1'}
    />
  )
}
