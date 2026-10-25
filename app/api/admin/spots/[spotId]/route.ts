import { db } from '@/db/client'
import { spots, spotNotes, routes, areas } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'

// 巡回状況の地図でスポットを選んだときに、住所・要注意・メモを取得する
export async function GET(_request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  if (!(await getAdminUser())) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })
  const { spotId } = await params
  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId))
  if (!spot) return Response.json({ error: 'not found' }, { status: 404 })
  const [note] = await db.select().from(spotNotes).where(eq(spotNotes.spotId, spotId))
  const [route] = await db.select().from(routes).where(eq(routes.id, spot.routeId))
  const [area] = route ? await db.select().from(areas).where(eq(areas.id, route.areaId)) : [null]
  return Response.json({
    id: spot.id, routeId: spot.routeId, orderInRoute: spot.orderInRoute, address: spot.address,
    isAlertSpot: spot.isAlertSpot, note: note?.note ?? null,
    routeLabel: `${area?.name ?? ''} — ${route?.name ?? ''}`,
  })
}

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
