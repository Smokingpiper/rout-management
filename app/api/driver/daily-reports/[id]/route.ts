import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as {
    wasteTypeId?: string | null
    totalWeightKg?: number
    memo?: string
    submit?: boolean
  }

  const patch: Partial<typeof dailyReports.$inferInsert> = {}
  if (body.wasteTypeId !== undefined) patch.wasteTypeId = body.wasteTypeId
  if (body.totalWeightKg !== undefined) patch.totalWeightKg = body.totalWeightKg
  if (body.memo !== undefined) patch.memo = body.memo
  if (body.submit) {
    patch.status = 'pending_approval'
    const user = await getCurrentUser()
    if (user) patch.submittedBy = user.id
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(dailyReports).set(patch).where(eq(dailyReports.id, id)).returning()
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(updated)
}
