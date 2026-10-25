import { db } from '@/db/client'
import { vehicles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'
import { getPrimaryCompany } from '@/lib/company'

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })

  const body = await request.json() as { plateNumber?: string; name?: string }
  const plateNumber = (body.plateNumber ?? '').trim().slice(0, 50)
  if (!plateNumber) return Response.json({ error: 'ナンバープレートを入力してください' }, { status: 400 })

  const company = admin.companyId ? { id: admin.companyId } : await getPrimaryCompany()
  if (!company) return Response.json({ error: '会社が見つかりません' }, { status: 400 })

  const existing = await db.select().from(vehicles).where(eq(vehicles.companyId, company.id))
  if (existing.some(v => v.plateNumber === plateNumber)) {
    return Response.json({ error: 'このナンバーは既に登録されています' }, { status: 409 })
  }

  const [vehicle] = await db.insert(vehicles).values({
    companyId: company.id,
    plateNumber,
    name: (body.name ?? '').trim().slice(0, 50) || null,
  }).returning()
  return Response.json(vehicle)
}
