import { db } from '@/db/client'
import { wasteTypes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'

// 収集物（大分類・内訳）の追加。parentId を指定すると、その大分類の内訳になる
export async function POST(request: Request) {
  if (!(await getAdminUser())) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })

  const body = await request.json() as { companyId?: string; name?: string; parentId?: string | null }
  const { companyId } = body
  const name = body.name?.trim()
  if (!companyId || !name) {
    return Response.json({ error: 'companyId, name are required' }, { status: 400 })
  }

  let parentId: string | null = null
  if (body.parentId) {
    const [parent] = await db.select().from(wasteTypes).where(eq(wasteTypes.id, body.parentId))
    if (!parent || parent.companyId !== companyId) return Response.json({ error: '親の収集物が見つかりません' }, { status: 400 })
    if (parent.parentId) return Response.json({ error: '内訳の下にさらに内訳は作れません' }, { status: 400 })
    parentId = parent.id
  }

  const siblings = await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, companyId))
  if (siblings.some(w => (w.parentId ?? null) === parentId && w.name === name)) {
    return Response.json({ error: '同じ名前の収集物が既にあります' }, { status: 409 })
  }

  const [wasteType] = await db.insert(wasteTypes).values({ companyId, name, parentId }).returning()
  return Response.json(wasteType)
}
