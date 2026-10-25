import { db } from '@/db/client'
import { dailyInspections, reportVisitedSpots, routeTrackPoints, spots, wasteTypes } from '@/db/schema'
import { and, asc, eq, gte, inArray, lte, max, min } from 'drizzle-orm'
import PrintableReport, { type PrintableData } from '@/components/PrintableReport'
import PrintButton from './PrintButton'
import { queryReportList, type ReportFilters } from '@/lib/reportQuery'
import { loadStampUsers, inspectionShiftFor, loadWeightBreakdown, type EarlyIncident } from '@/lib/reportData'
import { stampsFor } from '@/lib/reportStamps'
import { getPrimaryCompany } from '@/lib/company'

export const dynamic = 'force-dynamic'

const MAX_PRINT = 200
const STATUS_LABEL: Record<string, string> = {
  in_progress: '実施中',
  pending_approval: '承認待ち',
  approved: '承認済み',
}

function hhmm(d: Date | string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

export default async function PrintReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; status?: string; type?: string; id?: string }>
}) {
  const sp = await searchParams
  const filters: ReportFilters = {
    q: (sp.q ?? '').trim(),
    from: (sp.from ?? '').trim(),
    to: (sp.to ?? '').trim(),
    status: (sp.status ?? '').trim(),
    type: (sp.type ?? '').trim(),
    id: (sp.id ?? '').trim() || undefined,
  }

  const { reportList: found, routeById, areaById, userById } = await queryReportList(filters, MAX_PRINT + 1)
  const truncated = found.length > MAX_PRINT
  // 印刷は日付の古い順（紙で綴じやすいように）
  const reportList = found.slice(0, MAX_PRINT).sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.id.localeCompare(b.id))

  const company = await getPrimaryCompany()
  const wasteTypeList = await db.select().from(wasteTypes)
  const wasteTypeById = new Map(wasteTypeList.map(w => [w.id, w]))
  const stampUsers = await loadStampUsers(reportList)

  const reportIds = reportList.map(r => r.id)
  const breakdownByReport = await loadWeightBreakdown(reportIds)
  const submitterIds = [...new Set(reportList.map(r => r.submittedBy).filter((x): x is string => !!x))]
  const dates = reportList.map(r => r.reportDate).sort()

  // 作業前点検（提出者×日付×区分）
  const inspections = submitterIds.length && dates.length
    ? await db.select().from(dailyInspections).where(and(
        inArray(dailyInspections.userId, submitterIds),
        gte(dailyInspections.inspectionDate, dates[0]),
        lte(dailyInspections.inspectionDate, dates[dates.length - 1]),
      ))
    : []
  const inspectionByKey = new Map(inspections.map(i => [`${i.userId}|${i.inspectionDate}|${i.shiftType}`, i]))

  // 作業開始・終了時間（GPS記録の最初と最後）
  const bounds = reportIds.length
    ? await db
        .select({ id: routeTrackPoints.dailyReportId, first: min(routeTrackPoints.recordedAt), last: max(routeTrackPoints.recordedAt) })
        .from(routeTrackPoints)
        .where(inArray(routeTrackPoints.dailyReportId, reportIds))
        .groupBy(routeTrackPoints.dailyReportId)
    : []
  const boundsById = new Map(bounds.map(b => [b.id, b]))

  // 早朝回収で回ったスポット
  const earlyIds = reportList.filter(r => r.collectionType === 'early').map(r => r.id)
  const visitedRows = earlyIds.length
    ? await db
        .select({
          reportId: reportVisitedSpots.dailyReportId,
          address: spots.address,
          source: reportVisitedSpots.source,
          visitedAt: reportVisitedSpots.visitedAt,
        })
        .from(reportVisitedSpots)
        .innerJoin(spots, eq(reportVisitedSpots.spotId, spots.id))
        .where(and(inArray(reportVisitedSpots.dailyReportId, earlyIds), eq(reportVisitedSpots.excluded, false)))
        .orderBy(asc(reportVisitedSpots.visitedAt))
    : []
  const visitedByReport = new Map<string, typeof visitedRows>()
  for (const v of visitedRows) visitedByReport.set(v.reportId, [...(visitedByReport.get(v.reportId) ?? []), v])

  const sheets: PrintableData[] = reportList.map(r => {
    const isEarly = r.collectionType === 'early'
    const route = r.routeId ? routeById.get(r.routeId) : null
    const area = route ? areaById.get(route.areaId) : null
    const submitter = r.submittedBy ? userById.get(r.submittedBy) : null
    const inspection = r.submittedBy
      ? inspectionByKey.get(`${r.submittedBy}|${r.reportDate}|${inspectionShiftFor(r)}`) ?? null
      : null
    const b = boundsById.get(r.id)
    return {
      reportDate: r.reportDate,
      isEarly,
      companyName: company?.name ?? '',
      driverName: submitter ? (submitter.name || submitter.email || '') : '',
      routeLabel: isEarly ? '早朝回収' : `${area?.name ?? ''} — ${route?.name ?? ''}`,
      wasteTypeName: r.wasteTypeId ? (wasteTypeById.get(r.wasteTypeId)?.name ?? '') : '',
      totalWeightKg: r.totalWeightKg,
      weights: (breakdownByReport.get(r.id) ?? []).map(b => ({ name: b.name, weightKg: b.weightKg })),
      memo: r.memo ?? '',
      statusLabel: STATUS_LABEL[r.status] ?? r.status,
      startTime: hhmm(b?.first),
      endTime: hhmm(b?.last),
      stamps: stampsFor(r, stampUsers),
      inspection: inspection
        ? {
            vehicleNumber: inspection.vehicleNumber,
            shiftType: inspection.shiftType,
            checks: inspection.checks,
            startRollCall: inspection.startRollCall,
            endRollCall: inspection.endRollCall,
            nearMissNote: inspection.nearMissNote,
          }
        : null,
      visited: (visitedByReport.get(r.id) ?? []).map(v => ({ address: v.address, time: hhmm(v.visitedAt) ?? '', source: v.source })),
      incidents: (isEarly ? ((r.incidentLog ?? []) as EarlyIncident[]) : []),
    }
  })

  const conditionText = [
    filters.from || filters.to ? `期間 ${filters.from || '指定なし'} 〜 ${filters.to || '指定なし'}` : null,
    filters.status ? `状態 ${STATUS_LABEL[filters.status] ?? filters.status}` : null,
    filters.type ? (filters.type === 'early' ? '早朝回収のみ' : '通常回収のみ') : null,
    filters.q ? `キーワード「${filters.q}」` : null,
    filters.id ? 'この日報のみ' : null,
  ].filter(Boolean).join(' ／ ') || '絞り込みなし（全期間）'

  return (
    <>
      <div className="no-print card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>日報の一括印刷</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            {sheets.length}件（日付の古い順・1日報＝A4 1枚） ／ {conditionText}
          </div>
          {truncated && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 4 }}>
              対象が{MAX_PRINT}件を超えたため、新しい{MAX_PRINT}件のみ表示しています。期間を絞って分けて印刷してください。
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
            印刷ダイアログで用紙「A4・縦」を選び、「背景のグラフィック」をオンにすると見出しの色付けも印刷されます。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn" href="/admin/reports">← 日報一覧へ</a>
          <PrintButton disabled={sheets.length === 0} />
        </div>
      </div>

      {sheets.length === 0 ? (
        <div className="card no-print">条件に一致する日報がありません。</div>
      ) : (
        sheets.map((data, i) => <PrintableReport key={i} data={data} />)
      )}
    </>
  )
}
