import { db } from '@/db/client'
import { vehicles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'

// ナンバー・呼び名の変更と、使用停止／再開（点検画面の選択肢から外す。過去の記録はそのまま残る）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })
  const { id } = await params
  const body = await request.json() as { plateNumber?: string; name?: string | null; active?: boolean }

  const patch: Partial<typeof vehicles.$inferInsert> = {}
  if (body.plateNumber !== undefined) {
    const plate = body.plateNumber.trim().slice(0, 50)
    if (!plate) return Response.json({ error: 'ナンバープレートを入力してください' }, { status: 400 })
    patch.plateNumber = plate
  }
  if (body.name !== undefined) patch.name = (body.name ?? '').trim().slice(0, 50) || null
  if (body.active !== undefined) patch.active = !!body.active
  if (Object.keys(patch).length === 0) return Response.json({ error: 'no fields to update' }, { status: 400 })

  const [updated] = await db.update(vehicles).set(patch).where(eq(vehicles.id, id)).returning()
  if (!updated) return Response.json({ error: '車両が見つかりません' }, { status: 404 })
  return Response.json(updated)
}
