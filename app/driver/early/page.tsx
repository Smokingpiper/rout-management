import { db } from '@/db/client'
import { reportVisitedSpots, routeTrackPoints, wasteTypes } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isInspectionReady } from '@/lib/inspectionGate'
import { getOrCreateEarlyReport } from '@/lib/earlyReport'
import { loadVisitedSpots, type EarlyIncident } from '@/lib/reportData'
import { topLevelTypes } from '@/lib/wasteTypes'
import EarlyScreen from './EarlyScreen'

export const dynamic = 'force-dynamic'

export default async function EarlyPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/driver/early')

  // 早朝回収も、その日の「早朝」の作業前点検（点検項目＋始業点呼）が済むまでは始められない
  if (!(await isInspectionReady(user.id, 'early'))) {
    redirect(`/driver/inspection?type=early&next=${encodeURIComponent('/driver/early?start=1')}`)
  }

  const report = await getOrCreateEarlyReport(user.id)
  const visited = await loadVisitedSpots(report.id)
  const excluded = await db.select({ spotId: reportVisitedSpots.spotId }).from(reportVisitedSpots).where(and(
    eq(reportVisitedSpots.dailyReportId, report.id),
    eq(reportVisitedSpots.excluded, true),
  ))
  const [{ n: trackPointCount }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(routeTrackPoints)
    .where(eq(routeTrackPoints.dailyReportId, report.id))

  const companyWasteTypes = user.companyId ? await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, user.companyId)) : []

  return (
    <EarlyScreen
      report={{ id: report.id, status: report.status, reportDate: report.reportDate, wasteTypeId: report.wasteTypeId }}
      wasteTypeOptions={topLevelTypes(companyWasteTypes).map(w => ({ id: w.id, name: w.name }))}
      initialVisited={visited.map(v => ({ ...v, visitedAt: v.visitedAt.toISOString() }))}
      initialExcludedIds={excluded.map(e => e.spotId)}
      initialIncidents={(report.incidentLog ?? []) as EarlyIncident[]}
      trackPointCount={trackPointCount}
      autoStart={start === '1'}
    />
  )
}
