import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { loadOwnEarlyReport } from '@/lib/earlyReport'

const MAX_ROWS = 30

// 持ち去り車両の記録（車両番号・業者名・確認時間）を丸ごと保存する
export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const { dailyReportId, incidents } = await request.json() as { dailyReportId?: string; incidents?: unknown }
  if (typeof dailyReportId !== 'string' || !Array.isArray(incidents)) {
    return Response.json({ error: 'dailyReportId and incidents are required' }, { status: 400 })
  }
  const report = await loadOwnEarlyReport(user.id, dailyReportId)
  if (!report) return Response.json({ error: '早朝回収の日報が見つかりません' }, { status: 404 })
  if (report.status !== 'in_progress') return Response.json({ error: '提出済みの日報は変更できません' }, { status: 400 })

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const cleaned = incidents.slice(0, MAX_ROWS).map((x: any) => ({
    vehicleNumber: str(x?.vehicleNumber, 50),
    company: str(x?.company, 100),
    time: str(x?.time, 10),
  })).filter(x => x.vehicleNumber || x.company || x.time)

  await db.update(dailyReports).set({ incidentLog: cleaned }).where(eq(dailyReports.id, report.id))
  return Response.json({ ok: true, count: cleaned.length })
}
