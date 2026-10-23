import { db } from '@/db/client'
import { dailyReports, routes } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { todayStr } from './date'

// その日・そのルートの daily_reports を取得、なければ作成する。
// 「探す→なければ作る」の間に別のリクエストが先に作ることがある（画面の連打・複数画面の同時表示）。
// DBの一意制約（daily_reports_regular_unique）が二重作成を防ぎ、負けた側は作らずに先にできた日報を使う
export async function getOrCreateTodaysReport(routeId: string) {
  const today = todayStr()
  const [existing] = await db
    .select()
    .from(dailyReports)
    .where(and(eq(dailyReports.routeId, routeId), eq(dailyReports.reportDate, today), eq(dailyReports.collectionType, 'regular')))
    .orderBy(asc(dailyReports.id)) // 万一重複があっても、どの画面も同じ日報を選ぶようにする
  if (existing) return existing

  const [route] = await db.select().from(routes).where(eq(routes.id, routeId))
  const [created] = await db.insert(dailyReports).values({
    routeId,
    reportDate: today,
    wasteTypeId: route?.defaultWasteTypeId ?? null,
    status: 'in_progress',
  }).onConflictDoNothing().returning()
  if (created) return created

  const [raced] = await db
    .select()
    .from(dailyReports)
    .where(and(eq(dailyReports.routeId, routeId), eq(dailyReports.reportDate, today), eq(dailyReports.collectionType, 'regular')))
    .orderBy(asc(dailyReports.id))
  return raced
}
