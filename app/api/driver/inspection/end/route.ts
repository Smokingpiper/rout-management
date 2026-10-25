import { db } from '@/db/client'
import { dailyInspections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { todayStr } from '@/lib/date'
import { SHIFT_TYPES, cleanRollCall, type RollCall } from '@/lib/inspection'

const VALID_SHIFTS = new Set<string>(SHIFT_TYPES.map(s => s.value))

// 終業点呼の保存（日報の提出画面から呼ぶ）。その日・その区分の作業前点検の記録に追記する。
// 始業側の記録（点検項目・始業点呼）は触らない
export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const body = await request.json() as { shiftType?: string; endRollCall?: unknown }
  const shiftType = VALID_SHIFTS.has(body.shiftType ?? '') ? body.shiftType! : 'normal'
  const inspectionDate = todayStr()

  const [existing] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, user.id),
    eq(dailyInspections.inspectionDate, inspectionDate),
    eq(dailyInspections.shiftType, shiftType),
  ))

  const endRollCall = cleanRollCall(body.endRollCall, (existing?.endRollCall ?? null) as RollCall | null)

  const [saved] = existing
    ? await db.update(dailyInspections).set({ endRollCall, updatedAt: new Date() }).where(eq(dailyInspections.id, existing.id)).returning()
    : await db.insert(dailyInspections).values({ userId: user.id, inspectionDate, shiftType, checks: {}, endRollCall }).returning()

  return Response.json({ id: saved.id, endRollCall: saved.endRollCall })
}
