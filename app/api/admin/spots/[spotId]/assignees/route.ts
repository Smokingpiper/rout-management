import { db } from '@/db/client'
import { spotAssignments } from '@/db/schema'
import { eq } from 'drizzle-orm'

const MAX_ASSIGNEES_PER_SPOT = 5

// このスポットの担当ドライバーを丸ごと置き換える（最大5人まで）
export async function PUT(request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params
  const { userIds } = await request.json() as { userIds: string[] }

  const uniqueIds = [...new Set(userIds ?? [])]
  if (uniqueIds.length > MAX_ASSIGNEES_PER_SPOT) {
    return Response.json({ error: `1スポットにつき担当は最大${MAX_ASSIGNEES_PER_SPOT}人までです` }, { status: 400 })
  }

  await db.delete(spotAssignments).where(eq(spotAssignments.spotId, spotId))
  if (uniqueIds.length > 0) {
    await db.insert(spotAssignments).values(uniqueIds.map(userId => ({ spotId, userId })))
  }

  return Response.json({ ok: true, userIds: uniqueIds })
}
