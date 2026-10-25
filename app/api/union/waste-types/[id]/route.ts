import { db } from '@/db/client'
import { wasteTypes, wasteTypePrices, routes, dailyReports, reportWasteWeights, monthlySummaryItems } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'

// 名前の変更、大分類⇔内訳の付け替え
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })
  const { id } = await params
  const body = await request.json() as { name?: string; parentId?: string | null }

  const [current] = await db.select().from(wasteTypes).where(eq(wasteTypes.id, id))
  if (!current) return Response.json({ error: '収集物が見つかりません' }, { status: 404 })
  const all = await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, current.companyId))

  const patch: { name?: string; parentId?: string | null } = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return Response.json({ error: '名前を入力してください' }, { status: 400 })
    patch.name = name
  }
  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      patch.parentId = null
    } else {
      const parent = all.find(w => w.id === body.parentId)
      if (!parent || parent.id === id) return Response.json({ error: '親の収集物が不正です' }, { status: 400 })
      if (parent.parentId) return Response.json({ error: '内訳の下にさらに内訳は作れません' }, { status: 400 })
      // 内訳を持つ大分類は、他の大分類の内訳にはできない（2階層まで）
      if (all.some(w => w.parentId === id)) {
        return Response.json({ error: '内訳がある収集物は、他の内訳にできません。先に内訳を移動してください' }, { status: 400 })
      }
      patch.parentId = parent.id
    }
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: 'no fields to update' }, { status: 400 })

  const newParent = patch.parentId !== undefined ? patch.parentId : current.parentId
  const newName = patch.name ?? current.name
  if (all.some(w => w.id !== id && (w.parentId ?? null) === (newParent ?? null) && w.name === newName)) {
    return Response.json({ error: '同じ名前の収集物が既にあります' }, { status: 409 })
  }

  const [updated] = await db.update(wasteTypes).set(patch).where(eq(wasteTypes.id, id)).returning()
  return Response.json(updated)
}

async function countRows(q: Promise<{ n: number }[]>) {
  return (await q)[0]?.n ?? 0
}

// 一度も使われていない収集物だけ削除できる（日報・単価・ルート・集計で使われていると履歴が壊れるため）
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })
  const { id } = await params

  const n = sql<number>`count(*)`.mapWith(Number)
  const used =
    (await countRows(db.select({ n }).from(wasteTypes).where(eq(wasteTypes.parentId, id)))) +
    (await countRows(db.select({ n }).from(wasteTypePrices).where(eq(wasteTypePrices.wasteTypeId, id)))) +
    (await countRows(db.select({ n }).from(routes).where(eq(routes.defaultWasteTypeId, id)))) +
    (await countRows(db.select({ n }).from(dailyReports).where(eq(dailyReports.wasteTypeId, id)))) +
    (await countRows(db.select({ n }).from(reportWasteWeights).where(eq(reportWasteWeights.wasteTypeId, id)))) +
    (await countRows(db.select({ n }).from(monthlySummaryItems).where(eq(monthlySummaryItems.wasteTypeId, id))))
  if (used > 0) {
    return Response.json({ error: '単価・内訳・ルート・日報のいずれかで使われているため削除できません' }, { status: 409 })
  }
  await db.delete(wasteTypes).where(eq(wasteTypes.id, id))
  return Response.json({ ok: true })
}
