import { db } from '@/db/client'
import { routeTrackPoints } from '@/db/schema'

export async function POST(request: Request) {
  const body = await request.json() as { dailyReportId?: string; latitude?: number; longitude?: number }
  const { dailyReportId, latitude, longitude } = body
  if (!dailyReportId || latitude == null || longitude == null) {
    return Response.json({ error: 'dailyReportId, latitude, longitude are required' }, { status: 400 })
  }
  const [point] = await db.insert(routeTrackPoints).values({
    dailyReportId,
    latitude,
    longitude,
    recordedAt: new Date(),
  }).returning()
  return Response.json(point)
}
