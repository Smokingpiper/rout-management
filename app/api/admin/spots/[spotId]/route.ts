import { db } from '@/db/client'
import { spots } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params
  const body = await request.json() as { address?: string; name?: string; isAlertSpot?: boolean; orderInRoute?: number }

  const patch: Partial<typeof spots.$inferInsert> = {}
  if (body.address !== undefined) patch.address = body.address
  if (body.name !== undefined) patch.name = body.name
  if (body.isAlertSpot !== undefined) patch.isAlertSpot = body.isAlertSpot
  if (body.orderInRoute !== undefined) patch.orderInRoute = body.orderInRoute

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(spots).set(patch).where(eq(spots.id, spotId)).returning()
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(updated)
}
