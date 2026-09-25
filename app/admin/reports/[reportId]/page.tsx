import { db } from '@/db/client'
import { dailyReports, routes, areas, wasteTypes, spots, routeTrackPoints, spotAlertAcknowledgments } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import TrackMap from '@/components/TrackMap'
import ApproveActions from './ApproveActions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, reportId))
  if (!report) notFound()

  const [route] = await db.select().from(routes).where(eq(routes.id, report.routeId))
  const [area] = route ? await db.select().from(areas).where(eq(areas.id, route.areaId)) : [null]
  const wasteType = report.wasteTypeId ? (await db.select().from(wasteTypes).where(eq(wasteTypes.id, report.wasteTypeId)))[0] : null

  const spotList = await db.select().from(spots).where(eq(spots.routeId, report.routeId))
  const alertSpots = spotList.filter(s => s.isAlertSpot)
  const acks = alertSpots.length
    ? await db.select().from(spotAlertAcknowledgments).where(inArray(spotAlertAcknowledgments.spotId, alertSpots.map(s => s.id)))
    : []
  const ackedForThisReport = acks.filter(a => a.dailyReportId === report.id)

  const trackPoints = await db.select().from(routeTrackPoints).where(eq(routeTrackPoints.dailyReportId, report.id))

  return (
    <>
      <div className="breadcrumb"><a href="/admin/reports">日報一覧</a> / {report.reportDate}</div>
      <div className="page-title">{area?.name} — {route?.name}</div>
      <div className="page-desc">{report.reportDate} ・ {wasteType?.name ?? '品目未設定'} ・ <span className="pill muted">{STATUS_LABEL[report.status]}</span></div>

      <div className="card">
        <div className="card-title">提出内容</div>
        <table>
          <tbody>
            <tr><td style={{ color: 'var(--text-3)', width: 140 }}>総重量</td><td>{report.totalWeightKg != null ? `${report.totalWeightKg}kg` : '未入力'}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>メモ</td><td>{report.memo || '—'}</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>スポット数</td><td>{spotList.length}件（うち要注意 {alertSpots.length}件）</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>要注意スポット確認</td><td>{ackedForThisReport.length} / {alertSpots.length}件</td></tr>
            <tr><td style={{ color: 'var(--text-3)' }}>GPS記録点数</td><td>{trackPoints.length}件</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">軌跡（参考）</div>
        <TrackMap
          points={trackPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))}
          spots={spotList.map(s => ({ lat: s.latitude, lng: s.longitude, isAlertSpot: s.isAlertSpot }))}
        />
      </div>

      <ApproveActions reportId={report.id} status={report.status} />
    </>
  )
}
