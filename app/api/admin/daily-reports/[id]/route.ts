import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { status?: 'approved' | 'in_progress' | 'pending_approval' }

  if (!body.status) {
    return Response.json({ error: 'status is required' }, { status: 400 })
  }

  const patch: Partial<typeof dailyReports.$inferInsert> = { status: body.status }
  if (body.status === 'approved') {
    patch.approvedAt = new Date()
  } else {
    patch.approvedAt = null
    patch.approvedBy = null
  }

  const [updated] = await db.update(dailyReports).set(patch).where(eq(dailyReports.id, id)).returning()
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(updated)
}
