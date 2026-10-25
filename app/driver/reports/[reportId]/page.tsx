import { db } from '@/db/client'
import { dailyReports, routes, areas, wasteTypes, spots, routeTrackPoints, spotAlertAcknowledgments, missedSpotOverrides } from '@/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ReportTrackPanel from '@/components/ReportTrackPanel'
import InspectionSummaryCard from '@/components/InspectionSummaryCard'
import EarlyVisitedPanel from '@/components/EarlyVisitedPanel'
import ApprovalStamps from '@/components/ApprovalStamps'
import PhotoViewer from '@/components/PhotoViewer'
import { getCurrentUser } from '@/lib/auth'
import { filterSpotsForDriver } from '@/lib/driverSpots'
import { stampsFor } from '@/lib/reportStamps'
import { loadInspectionForReport, loadStampUsers, loadVisitedSpots, loadWeightBreakdown, type EarlyIncident } from '@/lib/reportData'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}

export default async function DriverReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, reportId))
  if (!report) notFound()

  const isEarly = report.collectionType === 'early'
  const [route] = report.routeId ? await db.select().from(routes).where(eq(routes.id, report.routeId)) : [null]
  const [area] = route ? await db.select().from(areas).where(eq(areas.id, route.areaId)) : [null]
  const breakdown = (await loadWeightBreakdown([report.id])).get(report.id) ?? []
  const wasteType = report.wasteTypeId ? (await db.select().from(wasteTypes).where(eq(wasteTypes.id, report.wasteTypeId)))[0] : null

  const allSpots = report.routeId ? await db.select().from(spots).where(eq(spots.routeId, report.routeId)) : []
  const user = await getCurrentUser()
  const spotList = user ? await filterSpotsForDriver(allSpots, user.id) : allSpots
  const alertSpots = spotList.filter(s => s.isAlertSpot)
  const acks = alertSpots.length
    ? await db.select().from(spotAlertAcknowledgments).where(inArray(spotAlertAcknowledgments.spotId, alertSpots.map(s => s.id)))
    : []
  const ackedForThisReport = acks.filter(a => a.dailyReportId === report.id)

  const trackPoints = await db.select().from(routeTrackPoints).where(eq(routeTrackPoints.dailyReportId, report.id)).orderBy(asc(routeTrackPoints.recordedAt))
  const overrides = await db.select().from(missedSpotOverrides).where(eq(missedSpotOverrides.dailyReportId, report.id))
  const visited = isEarly ? await loadVisitedSpots(report.id) : []

  // 作業前点検は自分が提出した日報にだけ表示する（同じルートの他のドライバーの
  // 点呼結果＝飲酒・体調の記録は、ここでは見せない。全体の確認は会社管理者の画面で行う）
  const isOwnReport = !!user && report.submittedBy === user.id
  const inspection = isOwnReport ? await loadInspectionForReport(report) : null

  const stamps = stampsFor(report, await loadStampUsers([report]))
  const title = isEarly ? '早朝回収' : `${area?.name ?? ''} — ${route?.name ?? ''}`

  return (
    <>
      <div className="breadcrumb"><a href="/driver/reports">日報一覧</a> / {report.reportDate}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="page-title">{title}</div>
          <div className="page-desc">{report.reportDate} ・ {wasteType?.name ?? '品目未設定'} ・ <span className="pill muted">{STATUS_LABEL[report.status]}</span></div>
        </div>
        <ApprovalStamps {...stamps} />
      </div>

      <div className="card">
        <div className="card-title">提出内容</div>
        <table>
          <tbody>
            <tr><td style={{ color: 'var(--text-3)', width: 140 }}>総重量</td><td>{report.totalWeightKg != null ? `${report.totalWeightKg}kg` : '未入力'}</td></tr>
            {breakdown.length > 0 && (
              <tr><td style={{ color: 'var(--text-3)' }}>収集物の内訳</td><td>{breakdown.map(b => `${b.name} ${b.weightKg}kg`).join('　／　')}</td></tr>
            )}
            <tr><td style={{ color: 'var(--text-3)' }}>メモ</td><td>{report.memo || '—'}</td></tr>
            {isEarly ? (
              <tr><td style={{ color: 'var(--text-3)' }}>回ったスポット</td><td>{visited.length}件</td></tr>
            ) : (
              <>
                <tr><td style={{ color: 'var(--text-3)' }}>スポット数</td><td>{spotList.length}件（うち要注意 {alertSpots.length}件）</td></tr>
                <tr><td style={{ color: 'var(--text-3)' }}>要注意スポット確認</td><td>{ackedForThisReport.length} / {alertSpots.length}件</td></tr>
              </>
            )}
            <tr><td style={{ color: 'var(--text-3)' }}>GPS記録点数</td><td>{trackPoints.length}件</td></tr>
          </tbody>
        </table>
      </div>

      {isOwnReport && (
        <InspectionSummaryCard inspection={inspection} emptyMessage="この日の作業前点検の記録はありません。" />
      )}

      <div className="card">
        <div className="card-title">添付写真</div>
        <PhotoViewer reportId={report.id} hasReportPhoto={!!report.reportPhotoUrl} hasReceiptPhoto={!!report.receiptPhotoUrl} />
      </div>

      {isEarly ? (
        <EarlyVisitedPanel
          visited={visited.map(v => ({ ...v, visitedAt: v.visitedAt.toISOString() }))}
          track={trackPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))}
          incidents={(report.incidentLog ?? []) as EarlyIncident[]}
        />
      ) : (
        <ReportTrackPanel
          points={trackPoints.map(p => ({ lat: p.latitude, lng: p.longitude, t: p.recordedAt.getTime() }))}
          spots={spotList}
          dailyReportId={report.id}
          initialOverriddenSpotIds={overrides.map(o => o.spotId)}
        />
      )}
    </>
  )
}
