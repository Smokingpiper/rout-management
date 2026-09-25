import { db } from '@/db/client'
import { routes, areas, dailyReports, routeTrackPoints, spots } from '@/db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import TrackPlot from '@/components/TrackPlot'

export const dynamic = 'force-dynamic'

export default async function TrackPage({
  params, searchParams,
}: {
  params: Promise<{ routeId: string }>
  searchParams: Promise<{ reportId?: string }>
}) {
  const { routeId } = await params
  const { reportId } = await searchParams

  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  if (!route) notFound()
  const [area] = await db.select().from(areas).where(eq(areas.id, route.areaId))

  const reportList = await db.select().from(dailyReports).where(eq(dailyReports.routeId, routeId)).orderBy(desc(dailyReports.reportDate))
  const selected = reportId ? reportList.find(r => r.id === reportId) : reportList[0]

  const trackPoints = selected
    ? await db.select().from(routeTrackPoints).where(eq(routeTrackPoints.dailyReportId, selected.id)).orderBy(asc(routeTrackPoints.recordedAt))
    : []
  const spotList = await db.select().from(spots).where(eq(spots.routeId, routeId))

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">{area?.name} — {route.name} の軌跡</div>
      <div className="page-desc">実際に記録されたGPS位置情報です（Google Maps未設定のため簡易表示）。</div>

      <div className="card">
        <div className="card-title">日別リスト</div>
        {reportList.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ記録がありません</div>}
        {reportList.map(r => (
          <a
            key={r.id}
            href={`/driver/routes/${routeId}/track?reportId=${r.id}`}
            style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', fontSize: 13,
              fontWeight: selected?.id === r.id ? 700 : 400,
            }}
          >
            <span>{r.reportDate}</span>
            <span style={{ color: 'var(--text-3)' }}>{r.totalWeightKg ? `${r.totalWeightKg}kg` : '記録中'}</span>
          </a>
        ))}
      </div>

      {selected && (
        <div className="card">
          <div className="card-title">{selected.reportDate} の軌跡（記録点 {trackPoints.length}件）</div>
          <TrackPlot
            points={trackPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))}
            spots={spotList.map(s => ({ lat: s.latitude, lng: s.longitude, isAlertSpot: s.isAlertSpot }))}
          />
        </div>
      )}
    </>
  )
}
