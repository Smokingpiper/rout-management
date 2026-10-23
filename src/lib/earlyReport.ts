import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { todayStr } from './date'

// 早朝回収の日報（ルートを持たない）。同じ日に複数のドライバーが早朝回収をしても
// 混ざらないよう、ドライバーごとに1日1件の日報を取得、なければ作成する
export async function getOrCreateEarlyReport(userId: string) {
  const today = todayStr()
  const [existing] = await db.select().from(dailyReports).where(and(
    eq(dailyReports.collectionType, 'early'),
    eq(dailyReports.reportDate, today),
    eq(dailyReports.startedBy, userId),
  )).orderBy(asc(dailyReports.id))
  if (existing) return existing

  // 連打などで同時に作られても1件になるよう、DBの一意制約（daily_reports_early_unique）に任せる
  const [created] = await db.insert(dailyReports).values({
    routeId: null,
    reportDate: today,
    collectionType: 'early',
    startedBy: userId,
    status: 'in_progress',
  }).onConflictDoNothing().returning()
  if (created) return created

  const [raced] = await db.select().from(dailyReports).where(and(
    eq(dailyReports.collectionType, 'early'),
    eq(dailyReports.reportDate, today),
    eq(dailyReports.startedBy, userId),
  )).orderBy(asc(dailyReports.id))
  return raced
}

// 自分の早朝回収の日報であることを確認して取得する（APIの権限チェック用）
export async function loadOwnEarlyReport(userId: string, reportId: string) {
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, reportId))
  if (!report || report.collectionType !== 'early' || report.startedBy !== userId) return null
  return report
}
