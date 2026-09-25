import { db } from '@/db/client'
import { spotAlertAcknowledgments } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json() as { dailyReportId?: string; spotId?: string }
  const { dailyReportId, spotId } = body
  if (!dailyReportId || !spotId) {
    return Response.json({ error: 'dailyReportId and spotId are required' }, { status: 400 })
  }

  const [existing] = await db.select().from(spotAlertAcknowledgments).where(and(
    eq(spotAlertAcknowledgments.dailyReportId, dailyReportId),
    eq(spotAlertAcknowledgments.spotId, spotId),
  ))
  if (existing) return Response.json(existing)

  const [ack] = await db.insert(spotAlertAcknowledgments).values({ dailyReportId, spotId }).returning()
  return Response.json(ack)
}
