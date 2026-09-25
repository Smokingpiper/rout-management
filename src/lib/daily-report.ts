import { db } from '@/db/client'
import { dailyReports, routes } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { todayStr } from './date'

// その日・そのルートの daily_reports を取得、なければ作成する（見つかるまで探してから作るので二重作成は起きにくい）
export async function getOrCreateTodaysReport(routeId: string) {
  const today = todayStr()
  const [existing] = await db
    .select()
    .from(dailyReports)
    .where(and(eq(dailyReports.routeId, routeId), eq(dailyReports.reportDate, today)))
  if (existing) return existing

  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  const [created] = await db.insert(dailyReports).values({
    routeId,
    reportDate: today,
    wasteTypeId: route?.defaultWasteTypeId ?? null,
    status: 'in_progress',
  }).returning()
  return created
}
