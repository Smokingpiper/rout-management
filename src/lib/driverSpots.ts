import { db } from '@/db/client'
import { spotAssignments } from '@/db/schema'
import { inArray } from 'drizzle-orm'

// あるルートでスポット単位の担当割り振り（spot_assignments）が1件も使われていなければ、
// そのルートの担当ドライバー全員が全スポットを見られる従来通りの挙動にする（後方互換）。
// 誰か1人でもスポット単位で割り振られていれば、以後はその設定を優先し、
// 各ドライバーは自分が担当になっているスポットだけに絞り込む。
export async function filterSpotsForDriver<T extends { id: string }>(
  allSpots: T[],
  userId: string,
): Promise<T[]> {
  if (allSpots.length === 0) return allSpots
  const spotIds = allSpots.map(s => s.id)
  const assignments = await db.select().from(spotAssignments).where(inArray(spotAssignments.spotId, spotIds))
  if (assignments.length === 0) return allSpots
  const myAssignedIds = new Set(assignments.filter(a => a.userId === userId).map(a => a.spotId))
  return allSpots.filter(s => myAssignedIds.has(s.id))
}
