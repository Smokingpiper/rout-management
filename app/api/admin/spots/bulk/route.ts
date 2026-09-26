import { db } from '@/db/client'
import { spots, spotNotes, spotAssignments } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

const MAX_ASSIGNEES_PER_SPOT = 5

export async function PATCH(request: Request) {
  const body = await request.json() as {
    spotIds?: string[]
    isAlertSpot?: boolean
    appendNote?: string
    addAssigneeUserId?: string
  }
  const { spotIds, isAlertSpot, appendNote, addAssigneeUserId } = body

  if (!spotIds || spotIds.length === 0) {
    return Response.json({ error: 'spotIds required' }, { status: 400 })
  }

  if (isAlertSpot !== undefined) {
    await db.update(spots).set({ isAlertSpot }).where(inArray(spots.id, spotIds))
  }

  if (appendNote) {
    const existing = await db.select().from(spotNotes).where(inArray(spotNotes.spotId, spotIds))
    const existingBySpot = new Map(existing.map(n => [n.spotId, n]))
    for (const spotId of spotIds) {
      const cur = existingBySpot.get(spotId)
      if (cur) {
        await db.update(spotNotes).set({ note: `${cur.note} / ${appendNote}` }).where(eq(spotNotes.id, cur.id))
      } else {
        await db.insert(spotNotes).values({ spotId, note: appendNote })
      }
    }
  }

  let skippedFull = 0
  if (addAssigneeUserId) {
    const existing = await db.select().from(spotAssignments).where(inArray(spotAssignments.spotId, spotIds))
    const countBySpot = new Map<string, number>()
    const hasUserBySpot = new Set<string>()
    for (const a of existing) {
      countBySpot.set(a.spotId, (countBySpot.get(a.spotId) ?? 0) + 1)
      if (a.userId === addAssigneeUserId) hasUserBySpot.add(a.spotId)
    }
    const toInsert: { spotId: string; userId: string }[] = []
    for (const spotId of spotIds) {
      if (hasUserBySpot.has(spotId)) continue
      if ((countBySpot.get(spotId) ?? 0) >= MAX_ASSIGNEES_PER_SPOT) { skippedFull++; continue }
      toInsert.push({ spotId, userId: addAssigneeUserId })
    }
    if (toInsert.length > 0) await db.insert(spotAssignments).values(toInsert)
  }

  return Response.json({ updated: spotIds.length, skippedFull })
}
