import { db } from '@/db/client'
import { routes } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params
  const body = await request.json() as { name?: string; defaultWasteTypeId?: string | null }

  const patch: Partial<typeof routes.$inferInsert> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.defaultWasteTypeId !== undefined) patch.defaultWasteTypeId = body.defaultWasteTypeId

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(routes).set(patch).where(eq(routes.id, routeId)).returning()
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(updated)
}
