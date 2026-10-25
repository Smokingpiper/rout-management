import { db } from '@/db/client'
import { wasteTypes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPrimaryCompany } from '@/lib/company'
import { orderedTree } from '@/lib/wasteTypes'
import WasteTypeMaster from './WasteTypeMaster'

export const dynamic = 'force-dynamic'

export default async function AdminWasteTypesPage() {
  const company = await getPrimaryCompany()
  const list = company ? await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, company.id)) : []

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">収集物マスタ</div>
      <div className="page-desc">
        収集するものの種類を登録します。古紙・ビン・缶のような<b>大分類</b>と、古紙の中の新聞・雑誌・段ボールのような<b>内訳</b>の2段階で作れます。
        ドライバーは収集のときに大分類を選び、内訳がある大分類は日報に内訳ごとの重さを入力します。
        単価（円/kg）は、協会管理者の「会社登録」画面で、内訳があれば内訳ごと、なければ大分類に設定します。
      </div>

      {company ? (
        <WasteTypeMaster
          companyId={company.id}
          items={orderedTree(list).map(({ item, depth }) => ({ id: item.id, name: item.name, parentId: item.parentId, depth }))}
        />
      ) : (
        <div className="card"><p style={{ fontSize: 13, color: 'var(--text-3)' }}>会社が登録されていません</p></div>
      )}
    </>
  )
}
