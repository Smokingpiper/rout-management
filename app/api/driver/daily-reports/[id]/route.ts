import { db } from '@/db/client'
import { dailyReports, reportWasteWeights, wasteTypes } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as {
    wasteTypeId?: string | null
    totalWeightKg?: number
    weights?: { wasteTypeId: string; weightKg: number }[]
    memo?: string
    submit?: boolean
  }

  const patch: Partial<typeof dailyReports.$inferInsert> = {}
  if (body.wasteTypeId !== undefined) patch.wasteTypeId = body.wasteTypeId
  if (body.totalWeightKg !== undefined) patch.totalWeightKg = body.totalWeightKg

  // 収集物ごとの重さ（内訳）。保存し直すたびに入れ替え、日報の総重量はその合計にそろえる
  let weightRows: { wasteTypeId: string; weightKg: number }[] | null = null
  if (body.weights !== undefined) {
    if (!Array.isArray(body.weights)) return Response.json({ error: 'weights must be an array' }, { status: 400 })
    const merged = new Map<string, number>()
    for (const w of body.weights) {
      const kg = Number(w?.weightKg)
      if (!w?.wasteTypeId || !Number.isFinite(kg) || kg < 0) return Response.json({ error: '重さの値が不正です' }, { status: 400 })
      if (kg > 0) merged.set(w.wasteTypeId, (merged.get(w.wasteTypeId) ?? 0) + kg)
    }
    const ids = [...merged.keys()]
    if (ids.length > 0) {
      const found = await db.select({ id: wasteTypes.id }).from(wasteTypes).where(inArray(wasteTypes.id, ids))
      if (found.length !== ids.length) return Response.json({ error: '収集物が見つかりません' }, { status: 400 })
    }
    weightRows = ids.map(wasteTypeId => ({ wasteTypeId, weightKg: Math.round(merged.get(wasteTypeId)! * 100) / 100 }))
    patch.totalWeightKg = Math.round(weightRows.reduce((s, r) => s + r.weightKg, 0) * 100) / 100
  }
  if (body.memo !== undefined) patch.memo = body.memo
  if (body.submit) {
    patch.status = 'pending_approval'
    patch.submittedAt = new Date()
    // 再提出（差し戻し後）では係長の押印は外れているので、念のため空にしておく
    patch.chiefStampedBy = null
    patch.chiefStampedAt = null
    const user = await getCurrentUser()
    if (user) patch.submittedBy = user.id
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(dailyReports).set(patch).where(eq(dailyReports.id, id)).returning()
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 })

  if (weightRows) {
    await db.delete(reportWasteWeights).where(eq(reportWasteWeights.dailyReportId, id))
    if (weightRows.length > 0) {
      await db.insert(reportWasteWeights).values(weightRows.map(r => ({ dailyReportId: id, ...r })))
    }
  }
  return Response.json(updated)
}
