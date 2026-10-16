import { db } from '@/db/client'
import { dailyInspections } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { todayStr } from '@/lib/date'
import type { Checks, RollCall, ShiftType } from '@/lib/inspection'
import InspectionForm from './InspectionForm'

export const dynamic = 'force-dynamic'

// 点検完了後に進める先。open redirect を避けるため、ドライバーのルート画面のURLだけを許可する
const SAFE_NEXT = /^\/driver\/routes\/[A-Za-z0-9-]+(\?start=1)?$/

export default async function InspectionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const nextHref = next && SAFE_NEXT.test(next) ? next : null
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/driver/inspection')

  const today = todayStr()
  const [record] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, user.id),
    eq(dailyInspections.inspectionDate, today),
  ))

  // 今日まだ入力していなければ、前回の車両番号・区分を引き継いで入力の手間を減らす
  const [last] = record
    ? [null]
    : await db.select().from(dailyInspections).where(eq(dailyInspections.userId, user.id)).orderBy(desc(dailyInspections.inspectionDate)).limit(1)

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">作業前点検</div>
      <div className="page-desc">日常点検・点呼表のデジタル版です。入力内容は自動で保存されます。</div>

      <InspectionForm
        today={today}
        nextHref={nextHref}
        driverName={user.name || user.email || ''}
        initial={{
          shiftType: ((record?.shiftType ?? last?.shiftType ?? 'normal') as ShiftType),
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
