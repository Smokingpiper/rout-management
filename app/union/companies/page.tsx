import { db } from '@/db/client'
import { companies } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPrimaryUnion } from '@/lib/union'
import NewCompanyForm from './NewCompanyForm'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const union = await getPrimaryUnion()
  const companyList = union ? await db.select().from(companies).where(eq(companies.unionId, union.id)) : []

  return (
    <>
      <div className="breadcrumb">協会管理者向け</div>
      <div className="page-title">会社登録</div>
      <div className="page-desc">{union?.name ?? '組合'}傘下の会社を登録・編集します。ここで選んだ会社が支払い配分編集画面の対象になります。</div>

      <div className="card">
        <table>
          <thead><tr><th>会社名</th><th>主な取扱品目</th><th>契約月額</th><th></th></tr></thead>
          <tbody>
            {companyList.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.wasteCategory ?? '—'}</td>
                <td>{c.monthlyFee != null ? `¥${c.monthlyFee.toLocaleString()}` : '—'}</td>
                <td><a className="btn sm" href={`/union/companies/${c.id}`}>配分編集へ</a></td>
              </tr>
            ))}
            {companyList.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>まだ会社が登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {union && <NewCompanyForm unionId={union.id} />}
    </>
  )
}
