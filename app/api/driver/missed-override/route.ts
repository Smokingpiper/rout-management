import { db } from '@/db/client'
import { missedSpotOverrides } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json() as { dailyReportId?: string; spotId?: string }
  const { dailyReportId, spotId } = body
  if (!dailyReportId || !spotId) {
    return Response.json({ error: 'dailyReportId and spotId are required' }, { status: 400 })
  }

  const [existing] = await db.select().from(missedSpotOverrides).where(and(
    eq(missedSpotOverrides.dailyReportId, dailyReportId),
    eq(missedSpotOverrides.spotId, spotId),
  ))
  if (existing) return Response.json(existing)

  const user = await getCurrentUser()
  const [override] = await db.insert(missedSpotOverrides).values({
    dailyReportId, spotId, clearedBy: user?.id ?? null,
  }).returning()
  return Response.json(override)
}

export async function DELETE(request: Request) {
  const body = await request.json() as { dailyReportId?: string; spotId?: string }
  const { dailyReportId, spotId } = body
  if (!dailyReportId || !spotId) {
    return Response.json({ error: 'dailyReportId and spotId are required' }, { status: 400 })
  }

  await db.delete(missedSpotOverrides).where(and(
    eq(missedSpotOverrides.dailyReportId, dailyReportId),
    eq(missedSpotOverrides.spotId, spotId),
  ))
  return Response.json({ ok: true })
}
