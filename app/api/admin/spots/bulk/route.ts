import { db } from '@/db/client'
import { spots, spotNotes } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function PATCH(request: Request) {
  const body = await request.json() as { spotIds?: string[]; isAlertSpot?: boolean; appendNote?: string }
  const { spotIds, isAlertSpot, appendNote } = body

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

  return Response.json({ updated: spotIds.length })
}
