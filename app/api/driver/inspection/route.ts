import { db } from '@/db/client'
import { dailyInspections, vehicles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { todayStr } from '@/lib/date'
import { VALID_CHECK_KEYS, SHIFT_TYPES, cleanRollCall, type Checks, type RollCall } from '@/lib/inspection'

const VALID_SHIFTS = new Set<string>(SHIFT_TYPES.map(s => s.value))

function cleanChecks(raw: unknown): Checks {
  const out: Checks = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (!VALID_CHECK_KEYS.has(key)) continue
    if (value?.result !== 'ok' && value?.result !== 'ng') continue
    out[key] = { result: value.result }
    if (value.result === 'ng' && typeof value.action === 'string' && value.action.trim()) {
      out[key].action = value.action.trim().slice(0, 500)
    }
  }
  return out
}

export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const body = await request.json() as {
    shiftType?: string
    vehicleNumber?: string
    vehicleId?: string | null
    checks?: unknown
    startRollCall?: unknown
    endRollCall?: unknown
    nearMissNote?: string
  }

  // 通常回収と早朝回収は紙の点検表も別なので、ドライバー×日付×区分で1件ずつ記録する
  const shiftType = VALID_SHIFTS.has(body.shiftType ?? '') ? body.shiftType! : 'normal'
  const inspectionDate = todayStr()
  const [existing] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, user.id),
    eq(dailyInspections.inspectionDate, inspectionDate),
    eq(dailyInspections.shiftType, shiftType),
  ))

  // 車両マスタから選んだ場合は、ナンバーをマスタの値で控える（クライアントの値は信用しない）
  let vehicleId: string | null = null
  let vehicleNumber = (body.vehicleNumber ?? '').trim().slice(0, 50) || null
  if (body.vehicleId) {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, body.vehicleId))
    if (v && (!user.companyId || v.companyId === user.companyId)) {
      vehicleId = v.id
      vehicleNumber = v.plateNumber
    }
  }

  const values = {
    shiftType,
    vehicleId,
    vehicleNumber,
    checks: cleanChecks(body.checks),
    startRollCall: cleanRollCall(body.startRollCall, (existing?.startRollCall ?? null) as RollCall | null),
    // 終業点呼は日報の提出時に別のAPIで保存する。ここで送られてこない場合は既存の記録を保つ
    endRollCall: body.endRollCall === undefined
      ? ((existing?.endRollCall ?? null) as RollCall | null)
      : cleanRollCall(body.endRollCall, (existing?.endRollCall ?? null) as RollCall | null),
    nearMissNote: (body.nearMissNote ?? '').trim().slice(0, 2000) || null,
    updatedAt: new Date(),
  }

  const [saved] = existing
    ? await db.update(dailyInspections).set(values).where(eq(dailyInspections.id, existing.id)).returning()
    : await db.insert(dailyInspections).values({ userId: user.id, inspectionDate, ...values }).returning()

  return Response.json({
    id: saved.id,
    updatedAt: saved.updatedAt,
    startRollCall: saved.startRollCall,
    endRollCall: saved.endRollCall,
  })
}
