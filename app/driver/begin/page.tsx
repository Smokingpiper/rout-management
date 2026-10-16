import { db } from '@/db/client'
import { userRoutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { todayDayOfWeek } from '@/lib/date'
import { isInspectionReady } from '@/lib/inspectionGate'

export const dynamic = 'force-dynamic'

// 「今日のルート」の［通常回収］［早朝回収］から来る入口（画面は持たず、振り分けだけ行う）
//   今日のルート → 回収の種類 → 作業前点検（その日の同じ区分が未完了なら）→ 早朝回収の画面 / 担当ルートの画面
export default async function BeginPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  const shift = type === 'early' ? 'early' : 'normal'

  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/driver/begin?type=${shift}`)}`)

  if (!(await isInspectionReady(user.id, shift))) {
    redirect(`/driver/inspection?type=${shift}&next=${encodeURIComponent(`/driver/begin?type=${shift}`)}`)
  }

  if (shift === 'early') redirect('/driver/early?start=1')

  // 通常回収: 今日担当のルートが1つならそのまま開始、複数なら選べるよう一覧に戻す
  const dow = todayDayOfWeek()
  const assignments = await db.select().from(userRoutes).where(eq(userRoutes.userId, user.id))
  const todays = assignments.filter(a => (a.daysOfWeek as number[]).includes(dow))
  if (todays.length === 1) redirect(`/driver/routes/${todays[0].routeId}?start=1`)
  redirect('/driver?type=normal')
}
