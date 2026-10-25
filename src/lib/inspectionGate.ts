import { db } from '@/db/client'
import { dailyInspections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { todayStr } from './date'
import { summarizeInspection, type RollCall } from './inspection'

// 今日の作業前点検が「出発できる状態」か（点検項目がすべて回答済み かつ 始業点呼が入力済み）。
// 通常回収と早朝回収は別々の点検表なので、区分ごとに判定する
export async function isInspectionReady(userId: string, shiftType: 'normal' | 'early' = 'normal'): Promise<boolean> {
  const [record] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, userId),
    eq(dailyInspections.inspectionDate, todayStr()),
    eq(dailyInspections.shiftType, shiftType),
  ))
  if (!record) return false
  const s = summarizeInspection(record)
  return s.checksDone && s.startDone
}

// 今日・この区分の終業点呼（日報の提出画面の初期値）。未入力なら null
export async function loadTodaysEndRollCall(userId: string | undefined, shiftType: 'normal' | 'early'): Promise<RollCall | null> {
  if (!userId) return null
  const [record] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, userId),
    eq(dailyInspections.inspectionDate, todayStr()),
    eq(dailyInspections.shiftType, shiftType),
  ))
  return (record?.endRollCall ?? null) as RollCall | null
}

// 巡回画面（ルート画面・スポット詳細）の入口で呼ぶ。今日の点検が未完了なら点検画面へ振り分け、
// 完了後は ?start=1 つきでルート画面に戻す（GPS記録が自動でONになる）。
// 日報が提出済みで巡回が終わっている場合は閲覧のみなので対象外にする
export async function requireInspectionForPatrol(userId: string | undefined, routeId: string, reportStatus: string) {
  if (!userId || reportStatus !== 'in_progress') return
  if (await isInspectionReady(userId)) return
  redirect(`/driver/inspection?next=${encodeURIComponent(`/driver/routes/${routeId}?start=1`)}`)
}
