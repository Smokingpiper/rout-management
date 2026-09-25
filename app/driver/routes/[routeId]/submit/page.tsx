import { db } from '@/db/client'
import { routes, areas, wasteTypes, spots } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getOrCreateTodaysReport } from '@/lib/daily-report'
import SubmitForm from './SubmitForm'

export const dynamic = 'force-dynamic'

export default async function SubmitPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const report = await getOrCreateTodaysReport(routeId)
  const wasteTypeList = area ? await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, area.companyId)) : []

  const [{ n: spotCount }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .where(eq(spots.routeId, routeId))

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">日報提出</div>
      <div className="page-desc">{area?.name} — {route.name} ・ {report.reportDate}<br />1日のルートに対して最後にまとめて入力します。</div>

      <SubmitForm
        routeId={routeId}
        report={report}
        wasteTypeList={wasteTypeList}
        spotCount={spotCount}
      />
    </>
  )
}
