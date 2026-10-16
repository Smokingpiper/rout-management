import { db } from '@/db/client'
import { dailyInspections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { todayStr } from '@/lib/date'
import { VALID_CHECK_KEYS, SHIFT_TYPES, isRollCallAnswered, type Checks, type RollCall } from '@/lib/inspection'

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

function tri(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null
}

// 記録時刻(at)はクライアントを信用せずサーバー側で付与する。点呼の4項目がすべて
// 回答された最初の保存時刻を点呼の実施時刻とみなし、以後は上書きしない
function cleanRollCall(raw: unknown, previous: RollCall | null): RollCall | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, any>
  const rollCall: RollCall = {
    caller: typeof r.caller === 'string' ? r.caller.trim().slice(0, 100) : '',
    faceToFace: tri(r.faceToFace),
    alcoholDeviceUsed: tri(r.alcoholDeviceUsed),
    drunk: tri(r.drunk),
    unwell: tri(r.unwell),
    note: typeof r.note === 'string' ? r.note.slice(0, 1000) : '',
  }
  const at = previous?.at ?? (isRollCallAnswered(rollCall) ? new Date().toISOString() : undefined)
  return at ? { ...rollCall, at } : rollCall
}

export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const body = await request.json() as {
    shiftType?: string
    vehicleNumber?: string
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

  const values = {
    shiftType,
    vehicleNumber: (body.vehicleNumber ?? '').trim().slice(0, 50) || null,
    checks: cleanChecks(body.checks),
    startRollCall: cleanRollCall(body.startRollCall, (existing?.startRollCall ?? null) as RollCall | null),
    endRollCall: cleanRollCall(body.endRollCall, (existing?.endRollCall ?? null) as RollCall | null),
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
