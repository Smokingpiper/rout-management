import { db } from '@/db/client'
import { userRoutes } from '@/db/schema'
import { eq } from 'drizzle-orm'

type Assignment = { routeId: string; daysOfWeek: number[] }

// そのユーザーの週次スケジュールを丸ごと置き換える（曜日未選択のルートは行ごと削除する）
export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const { assignments } = await request.json() as { assignments: Assignment[] }

  await db.delete(userRoutes).where(eq(userRoutes.userId, userId))

  const rows = (assignments ?? [])
    .filter(a => a.daysOfWeek && a.daysOfWeek.length > 0)
    .map(a => ({ userId, routeId: a.routeId, daysOfWeek: a.daysOfWeek }))

  if (rows.length > 0) {
    await db.insert(userRoutes).values(rows)
  }

  return Response.json({ ok: true, count: rows.length })
}
