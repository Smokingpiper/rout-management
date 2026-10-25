import { db } from '@/db/client'
import { wasteTypes, reportWasteWeights } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isInspectionReady, loadTodaysEndRollCall } from '@/lib/inspectionGate'
import { getOrCreateEarlyReport } from '@/lib/earlyReport'
import { loadVisitedSpots, type EarlyIncident } from '@/lib/reportData'
import EarlyVisitedPanel from '@/components/EarlyVisitedPanel'
import SubmitForm from '../../routes/[routeId]/submit/SubmitForm'

export const dynamic = 'force-dynamic'

export default async function EarlySubmitPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/driver/early/submit')
  if (!(await isInspectionReady(user.id, 'early'))) {
    redirect(`/driver/inspection?type=early&next=${encodeURIComponent('/driver/early?start=1')}`)
  }

  const report = await getOrCreateEarlyReport(user.id)
  const visited = await loadVisitedSpots(report.id)
  // ゴミ種別はドライバーの所属会社のものから選ぶ
  const wasteTypeList = user.companyId
    ? await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, user.companyId))
    : []

  const savedWeights = await db.select().from(reportWasteWeights).where(eq(reportWasteWeights.dailyReportId, report.id))

  return (
    <>
      <div className="breadcrumb"><a href="/driver/early">早朝回収</a> / 日報提出</div>
      <div className="page-title">早朝回収の日報提出</div>
      <div className="page-desc">{report.reportDate}<br />回ったスポットの一覧と持ち去り車両の記録が日報に載ります。総重量などを入力して提出してください。</div>

      <EarlyVisitedPanel
        visited={visited.map(v => ({ ...v, visitedAt: v.visitedAt.toISOString() }))}
        track={[]}
        incidents={(report.incidentLog ?? []) as EarlyIncident[]}
      />

      <SubmitForm
        report={report}
        wasteTypeList={wasteTypeList}
        initialWeights={savedWeights.map(w => ({ wasteTypeId: w.wasteTypeId, weightKg: w.weightKg }))}
        spotCount={visited.length}
        early
        initialEndRollCall={await loadTodaysEndRollCall(user.id, 'early')}
      />
    </>
  )
}
