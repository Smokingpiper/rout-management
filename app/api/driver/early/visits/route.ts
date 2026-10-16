import { db } from '@/db/client'
import { reportVisitedSpots, spots } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { loadOwnEarlyReport } from '@/lib/earlyReport'

async function authorize(dailyReportId: unknown) {
  const user = await getCurrentUser()
  if (!user) return { error: Response.json({ error: 'ログインが必要です' }, { status: 401 }) }
  if (typeof dailyReportId !== 'string') return { error: Response.json({ error: 'dailyReportId is required' }, { status: 400 }) }
  const report = await loadOwnEarlyReport(user.id, dailyReportId)
  if (!report) return { error: Response.json({ error: '早朝回収の日報が見つかりません' }, { status: 404 }) }
  if (report.status !== 'in_progress') return { error: Response.json({ error: '提出済みの日報は変更できません' }, { status: 400 }) }
  return { report }
}

// 回ったスポットを追加する。GPS通過での自動追加(gps)と手動追加(manual)がある。
// ドライバーが外したスポットはGPSが勝手に再追加しない（手動で追加し直したときだけ戻す）
export async function POST(request: Request) {
  const { dailyReportId, spotId, source } = await request.json() as { dailyReportId?: string; spotId?: string; source?: string }
  const auth = await authorize(dailyReportId)
  if (auth.error) return auth.error
  if (typeof spotId !== 'string') return Response.json({ error: 'spotId is required' }, { status: 400 })
  const resolvedSource = source === 'manual' ? 'manual' : 'gps'

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId))
  if (!spot) return Response.json({ error: 'spot not found' }, { status: 404 })

  const [existing] = await db.select().from(reportVisitedSpots).where(and(
    eq(reportVisitedSpots.dailyReportId, auth.report!.id),
    eq(reportVisitedSpots.spotId, spotId),
  ))

  let visited = true
  if (!existing) {
    await db.insert(reportVisitedSpots).values({ dailyReportId: auth.report!.id, spotId, source: resolvedSource })
  } else if (existing.excluded) {
    if (resolvedSource === 'manual') {
      await db.update(reportVisitedSpots).set({ excluded: false, source: 'manual', visitedAt: new Date() }).where(eq(reportVisitedSpots.id, existing.id))
    } else {
      visited = false
    }
  }

  return Response.json({
    visited,
    spot: { id: spot.id, address: spot.address, latitude: spot.latitude, longitude: spot.longitude },
    source: existing && !existing.excluded ? existing.source : resolvedSource,
    visitedAt: (existing && !existing.excluded ? existing.visitedAt : new Date()).toISOString(),
  })
}

// 回ったスポットから外す（記録は excluded として残し、GPSによる再追加を防ぐ）
export async function DELETE(request: Request) {
  const { dailyReportId, spotId } = await request.json() as { dailyReportId?: string; spotId?: string }
  const auth = await authorize(dailyReportId)
  if (auth.error) return auth.error
  if (typeof spotId !== 'string') return Response.json({ error: 'spotId is required' }, { status: 400 })

  const [existing] = await db.select().from(reportVisitedSpots).where(and(
    eq(reportVisitedSpots.dailyReportId, auth.report!.id),
    eq(reportVisitedSpots.spotId, spotId),
  ))
  if (existing) {
    await db.update(reportVisitedSpots).set({ excluded: true }).where(eq(reportVisitedSpots.id, existing.id))
  } else {
    await db.insert(reportVisitedSpots).values({ dailyReportId: auth.report!.id, spotId, source: 'manual', excluded: true })
  }
  return Response.json({ ok: true })
}
