import { db } from '@/db/client'
import { vehicles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPrimaryCompany } from '@/lib/company'
import VehicleMaster from './VehicleMaster'

export const dynamic = 'force-dynamic'

export default async function AdminVehiclesPage() {
  const company = await getPrimaryCompany()
  const list = company ? await db.select().from(vehicles).where(eq(vehicles.companyId, company.id)) : []
  const sorted = [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.plateNumber.localeCompare(b.plateNumber, 'ja'))

  return (
    <>
      <div className="breadcrumb">会社管理者向け</div>
      <div className="page-title">車両マスタ</div>
      <div className="page-desc">
        収集に使う車両のナンバープレートを登録します。ドライバーは作業前点検で、使う車両をここから選びます。
        選んだ車両は点検記録・日報（印刷を含む）に残ります。使わなくなった車両は「使用停止」にすると、選択肢から外れます（過去の記録は残ります）。
      </div>
      <VehicleMaster
        items={sorted.map(v => ({ id: v.id, plateNumber: v.plateNumber, name: v.name, active: v.active }))}
      />
    </>
  )
}
