import { db } from '@/db/client'
import { spotNotes } from '@/db/schema'
import { eq } from 'drizzle-orm'

// スポットの備考は住所とは別項目として1件のみ保持する（履歴は持たない）。
// 更新のたびに既存行を消して入れ直すことで、常に0〜1件に正規化する。
export async function PUT(request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params
  const { note } = await request.json() as { note?: string }
  const trimmed = (note ?? '').trim()

  await db.delete(spotNotes).where(eq(spotNotes.spotId, spotId))
  if (trimmed) {
    await db.insert(spotNotes).values({ spotId, note: trimmed })
  }

  return Response.json({ note: trimmed || null })
}
