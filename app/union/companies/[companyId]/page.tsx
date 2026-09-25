import { db } from '@/db/client'
import { companies, feeRules, paymentAllocations, monthlySummaries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryUnion } from '@/lib/union'
import FeeRuleForm from './FeeRuleForm'

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
        <div className="card-title">
          月次配分結果
          <a className="btn sm" href={`/api/union/companies/${company.id}/allocations.csv`}>⬇ CSVダウンロード</a>
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
            まだ配分結果がありません。月次集計（monthly_summaries）から配分を計算するバッチ処理は未実装です。
            {summaries.length === 0 && '（月次集計データ自体もまだありません）'}
          </p>
        )}
      </div>
    </>
  )
}
