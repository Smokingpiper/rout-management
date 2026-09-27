import { db } from '@/db/client'
import { companies, feeRules, paymentAllocations, monthlySummaries, monthlySummaryItems, wasteTypes, wasteTypePrices } from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryUnion } from '@/lib/union'
import FeeRuleForm from './FeeRuleForm'
import WasteTypePriceForm from './WasteTypePriceForm'
import RecalculateButton from './RecalculateButton'
import BarChart from '@/components/BarChart'

export const dynamic = 'force-dynamic'

const FEE_TYPE_LABEL: Record<string, string> = {
  rate_percent: '定率（%）',
  fixed_amount: '固定額',
}

export default async function CompanyAllocationPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
  if (!company) notFound()
  const union = await getPrimaryUnion()

  const ruleHistory = await db.select().from(feeRules).where(eq(feeRules.companyId, companyId)).orderBy(desc(feeRules.effectiveFrom))
  const currentRule = ruleHistory[0]

  const allocations = await db.select().from(paymentAllocations).where(eq(paymentAllocations.companyId, companyId)).orderBy(desc(paymentAllocations.yearMonth))
  const summaries = await db.select().from(monthlySummaries).where(eq(monthlySummaries.companyId, companyId)).orderBy(desc(monthlySummaries.yearMonth))

  const companyWasteTypes = await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, companyId))
  const priceHistory = companyWasteTypes.length > 0
    ? await db.select().from(wasteTypePrices).where(inArray(wasteTypePrices.wasteTypeId, companyWasteTypes.map(w => w.id))).orderBy(desc(wasteTypePrices.effectiveFrom))
    : []
  const currentPriceByWasteType = new Map<string, typeof priceHistory[number]>()
  for (const p of priceHistory) {
    if (!currentPriceByWasteType.has(p.wasteTypeId)) currentPriceByWasteType.set(p.wasteTypeId, p)
  }

  const latestYearMonth = summaries[0]?.yearMonth
  const latestItems = latestYearMonth
    ? await db.select().from(monthlySummaryItems).where(eq(monthlySummaryItems.yearMonth, latestYearMonth))
      .then(rows => rows.filter(r => r.companyId === companyId))
    : []
  const wasteTypeNameById = new Map(companyWasteTypes.map(w => [w.id, w.name]))

  return (
    <>
      <div className="breadcrumb"><a href="/union/companies">会社登録</a> / {company.name}</div>
      <div className="page-title">{company.name} の支払い配分</div>
      <div className="page-desc">手数料ルールを設定し、月次集計から配分額を計算します（{union?.name}）。</div>

      <div className="card">
        <div className="card-title">現在の手数料ルール</div>
        {currentRule ? (
          <p style={{ fontSize: 14 }}>
            {FEE_TYPE_LABEL[currentRule.feeType]} — <b>{currentRule.feeValue}{currentRule.feeType === 'rate_percent' ? '%' : '円'}</b>
            <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{currentRule.effectiveFrom} 〜</span>
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだルールが設定されていません（全社共通ルールが適用されます）</p>
        )}

        {ruleHistory.length > 1 && (
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>タイプ</th><th>値</th><th>適用開始日</th></tr></thead>
            <tbody>
              {ruleHistory.slice(1).map(r => (
                <tr key={r.id}><td>{FEE_TYPE_LABEL[r.feeType]}</td><td>{r.feeValue}{r.feeType === 'rate_percent' ? '%' : '円'}</td><td>{r.effectiveFrom}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {union && <FeeRuleForm unionId={union.id} companyId={company.id} />}

      <div className="card">
        <div className="card-title">品目マスタ・単価設定</div>
        {companyWasteTypes.length > 0 ? (
          <table>
            <thead><tr><th>品目</th><th>現在の単価</th><th>適用開始日</th></tr></thead>
            <tbody>
              {companyWasteTypes.map(w => {
                const price = currentPriceByWasteType.get(w.id)
                return (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{price ? `¥${price.unitPrice.toLocaleString()} / kg` : <span style={{ color: 'var(--text-3)' }}>未設定</span>}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{price?.effectiveFrom ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ品目が登録されていません</p>
        )}
      </div>

      <WasteTypePriceForm companyId={company.id} wasteTypeOptions={companyWasteTypes.map(w => ({ id: w.id, name: w.name }))} />

      <div className="card">
        <div className="card-title">
          月次配分結果
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn sm" href={`/api/union/companies/${company.id}/summary-items.csv`}>⬇ 品目別内訳CSV</a>
            <a className="btn sm" href={`/api/union/companies/${company.id}/allocations.csv`}>⬇ 配分結果CSV</a>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <RecalculateButton companyId={company.id} />
        </div>

        {allocations.length > 0 ? (
          <table>
            <thead><tr><th>年月</th><th>総額(gross)</th><th>手数料</th><th>配分額</th></tr></thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.id}>
                  <td>{a.yearMonth}</td>
                  <td>¥{a.grossAmount.toLocaleString()}</td>
                  <td>¥{a.feeAmount.toLocaleString()}</td>
                  <td>¥{a.allocatedAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            まだ配分結果がありません。「月次集計を再計算する」を押すと、承認済み日報と品目単価から自動計算されます。
            {companyWasteTypes.every(w => !currentPriceByWasteType.has(w.id)) && companyWasteTypes.length > 0 && '（品目の単価が未設定だと金額は0円になります）'}
          </p>
        )}

        {latestItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{latestYearMonth} の品目別内訳</div>
            <BarChart
              items={latestItems.map(it => ({ label: wasteTypeNameById.get(it.wasteTypeId) ?? '不明', value: it.totalAmount }))}
              formatValue={v => `¥${v.toLocaleString()}`}
            />
          </div>
        )}
      </div>
    </>
  )
}
