import { db } from '@/db/client'
import { dailyInspections } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { todayStr } from '@/lib/date'
import type { Checks, RollCall, ShiftType } from '@/lib/inspection'
import InspectionForm from './InspectionForm'

export const dynamic = 'force-dynamic'

// 点検完了後に進める先。open redirect を避けるため、ドライバー向けの巡回画面のURLだけを許可する
//   /driver/routes/<id>(?start=1) … 通常回収のルート画面
//   /driver/begin?type=normal|early … 「今日のルート」から回収を開始する入口
//   /driver/early(?start=1) … 早朝回収の画面
const SAFE_NEXT = /^\/driver\/(routes\/[A-Za-z0-9-]+(\?start=1)?|begin\?type=(normal|early)|early(\?start=1)?)$/

export default async function InspectionPage({ searchParams }: { searchParams: Promise<{ next?: string; type?: string }> }) {
  const { next, type } = await searchParams
  const nextHref = next && SAFE_NEXT.test(next) ? next : null
  const shiftType: ShiftType = type === 'early' ? 'early' : 'normal'
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/driver/inspection')

  const today = todayStr()
  // 通常回収と早朝回収は別々の点検表（ドライバー×日付×区分で1件）
  const [record] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, user.id),
    eq(dailyInspections.inspectionDate, today),
    eq(dailyInspections.shiftType, shiftType),
  ))

  // 今日まだ入力していなければ、前回の車両番号を引き継いで入力の手間を減らす
  const [last] = record
    ? [null]
    : await db.select().from(dailyInspections).where(eq(dailyInspections.userId, user.id)).orderBy(desc(dailyInspections.inspectionDate)).limit(1)

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">作業前点検</div>
      <div className="page-desc">日常点検・点呼表のデジタル版です。入力内容は自動で保存されます。通常回収と早朝回収は別々に記録します。</div>

      <InspectionForm
        key={shiftType}
        today={today}
        shiftType={shiftType}
        nextHref={nextHref}
        driverName={user.name || user.email || ''}
        initial={{
          vehicleNumber: record?.vehicleNumber ?? last?.vehicleNumber ?? '',
          checks: (record?.checks ?? {}) as Checks,
          startRollCall: (record?.startRollCall ?? null) as RollCall | null,
          endRollCall: (record?.endRollCall ?? null) as RollCall | null,
          nearMissNote: record?.nearMissNote ?? '',
        }}
      />
    </>
  )
}
