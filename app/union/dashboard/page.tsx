import { db } from '@/db/client'
import { companies, monthlySummaries, monthlySummaryItems, wasteTypes, paymentAllocations } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getPrimaryUnion } from '@/lib/union'
import BarChart from '@/components/BarChart'
import TrendChart from '@/components/TrendChart'

export const dynamic = 'force-dynamic'

export default async function UnionDashboardPage() {
  const union = await getPrimaryUnion()
  const companyList = union ? await db.select().from(companies).where(eq(companies.unionId, union.id)) : []
  const companyNameById = new Map(companyList.map(c => [c.id, c.name]))

  const allSummaries = await db.select().from(monthlySummaries).orderBy(desc(monthlySummaries.yearMonth))
  const allItems = await db.select().from(monthlySummaryItems)
  const allWasteTypes = await db.select().from(wasteTypes)
  const wasteTypeNameById = new Map(allWasteTypes.map(w => [w.id, w.name]))
  const allAllocations = await db.select().from(paymentAllocations)

  const latestYearMonth = allSummaries[0]?.yearMonth ?? null

  const byCompanyThisMonth = latestYearMonth
    ? allSummaries.filter(s => s.yearMonth === latestYearMonth).map(s => ({
      label: companyNameById.get(s.companyId) ?? '不明', value: s.totalAmount,
    }))
    : []

  const byWasteTypeThisMonth = latestYearMonth
    ? Object.entries(
      allItems.filter(i => i.yearMonth === latestYearMonth).reduce<Record<string, number>>((acc, i) => {
        const name = wasteTypeNameById.get(i.wasteTypeId) ?? '不明'
        acc[name] = (acc[name] ?? 0) + i.totalAmount
        return acc
      }, {})
    ).map(([label, value]) => ({ label, value }))
    : []

  const monthTotals = Object.entries(
    allSummaries.reduce<Record<string, number>>((acc, s) => {
      acc[s.yearMonth] = (acc[s.yearMonth] ?? 0) + s.totalAmount
      return acc
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, value]) => ({ label, value }))

  const allocatedTotals = Object.entries(
    allAllocations.reduce<Record<string, number>>((acc, a) => {
      acc[a.yearMonth] = (acc[a.yearMonth] ?? 0) + a.allocatedAmount
      return acc
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, value]) => ({ label, value }))

  return (
    <>
      <div className="breadcrumb">協会管理者向け</div>
      <div className="page-title">支払いダッシュボード</div>
      <div className="page-desc">
        全社の月次集計を横断して確認します（{union?.name}）。
        {latestYearMonth && <span> 最新集計月：<b>{latestYearMonth}</b></span>}
      </div>

      {allSummaries.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            まだ月次集計データがありません。各会社のページで「月次集計を再計算する」を実行すると、ここに集計結果が表示されます。
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">会社別 総額（{latestYearMonth}）</div>
            <BarChart items={byCompanyThisMonth} formatValue={v => `¥${v.toLocaleString()}`} />
          </div>

          <div className="card">
            <div className="card-title">品目別 総額（{latestYearMonth} ・ 全社合計）</div>
            <BarChart items={byWasteTypeThisMonth} formatValue={v => `¥${v.toLocaleString()}`} />
          </div>

          <div className="card">
            <div className="card-title">月次推移（総額 / 全社合計）</div>
            <TrendChart points={monthTotals} formatValue={v => `¥${v.toLocaleString()}`} />
          </div>

          <div className="card">
            <div className="card-title">月次推移（配分額 / 手数料控除後・全社合計）</div>
            <TrendChart points={allocatedTotals} formatValue={v => `¥${v.toLocaleString()}`} color="var(--accent-2)" />
          </div>
        </>
      )}
    </>
  )
}
